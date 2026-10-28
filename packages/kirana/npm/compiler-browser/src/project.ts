/**
 * A Kirana project held in memory, for the engine in a browser (KRN-CMP-012, D-113): the files are
 * written to the WebAssembly engine's file system, so a module's imports, the tokens it reads and
 * the configuration's scale modules resolve as they would on disk, and the `Compiler` session
 * compiles them.
 *
 * Nothing here loads the engine: `openProject` takes it, so the same code runs on the native engine
 * and a directory in the tests, and on the WebAssembly engine and its in-memory volume in a page.
 */
import { engineJson } from "@kirana-style/compiler/engine-json"
import type { KiranaConfig } from "@kirana-style/core/config"

/** The file system calls a project makes: memfs's volume in a browser, `node:fs` in the tests. */
export type Volume = {
  mkdirSync: (path: string, options: { recursive: true }) => unknown
  writeFileSync: (path: string, data: string) => void
  rmSync: (path: string, options: { force: true }) => void
}

/** The engine's compilation session, as the binding gives it. */
export type Session = {
  transform: (
    id: string,
    code: string
  ) => {
    code?: string
    map?: string
    diagnostics: string
    cssChanged: boolean
    dependencies: string[]
  }
  stylesheet: (minify: boolean) => string
  diagnostics: () => string
  invalidate: (id: string) => string[]
  remove: (id: string) => boolean
}

/** What `openProject` needs from the engine. */
export type Engine = {
  Compiler: new (configJson: string) => Session
  __volume: Volume
}

/** A place in a file: line and column from 1, the column in UTF-16 code units as editors count. */
export type Position = { line: number; column: number }

/** A diagnostic, with its span as positions in the file it names as well as the engine's bytes. */
export type Diagnostic = {
  code: string
  name: string
  severity: "info" | "warning" | "error"
  /** The file, relative to the project root; empty for the project as a whole. */
  file: string
  message: string
  help: string[]
  /** UTF-8 byte offsets, as the engine counts. */
  span: { start: number; end: number }
  /** Where the span starts and ends; undefined when the diagnostic names no file of the project. */
  start?: Position
  end?: Position
}

export type Transformed = {
  /** The rewritten module, still TypeScript and JSX; undefined when the module has no styles. */
  code?: string
  map?: string
  diagnostics: Diagnostic[]
  /** Whether the stylesheet changed. */
  cssChanged: boolean
  /** Files the module read while it compiled, relative to the root. */
  dependencies: string[]
}

export type ProjectOptions = {
  /** The configuration, already evaluated: what `kirana.config.ts`'s default export holds. */
  config?: KiranaConfig
  /** Where the project lives in the engine's file system. Default `/app`. */
  root?: string
  /** Files to write first, by path relative to the root. */
  files?: Readonly<Record<string, string>>
}

export type Project = {
  readonly root: string
  /** The configuration as the engine received it. */
  readonly configJson: string
  /**
   * Writes a file (relative to the root) and invalidates what read it: the files returned, relative
   * to the root, need transforming again.
   */
  write: (file: string, code: string) => string[]
  /** Removes a file, and what it contributed to the stylesheet. */
  remove: (file: string) => void
  /** Compiles a file written before. */
  transform: (file: string) => Transformed
  /** The stylesheet of every module transformed so far. */
  stylesheet: (minify?: boolean) => string
  /** Diagnostics about the project as a whole (token and relation checks). */
  diagnostics: () => Diagnostic[]
  /** The files written, relative to the root, in the order they were first written. */
  files: () => string[]
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** The position of a UTF-8 byte offset in `source`. */
export function positionOf(source: string, offset: number): Position {
  const before = decoder.decode(encoder.encode(source).subarray(0, offset))
  const lines = before.split("\n")
  return { line: lines.length, column: lines.at(-1)!.length + 1 }
}

/** A path relative to `root`, absolute as the engine needs it. */
function absolute(root: string, file: string): string {
  return `${root}/${file.replace(/^\.?\//, "")}`
}

/** An engine path back to one relative to `root`; a path outside it is kept as it is. */
function relative(root: string, file: string): string {
  return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file
}

/** Opens a project on `engine`: the configuration becomes the engine's JSON, the files are written. */
export function openProject(
  engine: Engine,
  { config = {}, root = "/app", files = {} }: ProjectOptions = {}
): Project {
  const configJson = engineJson(root, config, {})
  const volume = engine.__volume
  volume.mkdirSync(root, { recursive: true })
  const session = new engine.Compiler(configJson)
  const sources = new Map<string, string>()

  const diagnosticsOf = (json: string): Diagnostic[] =>
    (JSON.parse(json) as Diagnostic[]).map((diagnostic) => {
      const source = sources.get(diagnostic.file)
      return source === undefined
        ? diagnostic
        : {
            ...diagnostic,
            start: positionOf(source, diagnostic.span.start),
            end: positionOf(source, diagnostic.span.end),
          }
    })

  const project: Project = {
    root,
    configJson,
    write(file, code) {
      const path = absolute(root, file)
      volume.mkdirSync(path.slice(0, path.lastIndexOf("/")), {
        recursive: true,
      })
      volume.writeFileSync(path, code)
      sources.set(relative(root, path), code)
      return session.invalidate(path).map((id) => relative(root, id))
    },
    remove(file) {
      const path = absolute(root, file)
      volume.rmSync(path, { force: true })
      sources.delete(relative(root, path))
      session.remove(path)
    },
    transform(file) {
      const path = absolute(root, file)
      const code = sources.get(relative(root, path))
      if (code === undefined)
        throw new Error(`${file} is not a file of this project`)
      const result = session.transform(path, code)
      return {
        code: result.code,
        map: result.map,
        diagnostics: diagnosticsOf(result.diagnostics),
        cssChanged: result.cssChanged,
        dependencies: result.dependencies.map((id) => relative(root, id)),
      }
    },
    stylesheet: (minify = false) => session.stylesheet(minify),
    diagnostics: () => diagnosticsOf(session.diagnostics()),
    files: () => [...sources.keys()],
  }
  for (const [file, code] of Object.entries(files)) project.write(file, code)
  return project
}
