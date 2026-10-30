/**
 * `kirana-style dev [paths] [--out <file>] [--minify]` (KRN-DX-008): watch mode for projects without
 * a bundler (plain HTML, web components, server templates). It compiles every script under `paths`
 * and, on each change, the file and the modules that read a value from it (KRN-INT-009), rewriting
 * the stylesheet, and with `classes` the class map (D-069), only when it changed. Like `kirana-style
 * build`, it writes styles only; the scripts are left to the project's own toolchain.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  watch as fsWatch,
  writeFileSync,
} from "node:fs"
import type { FSWatcher } from "node:fs"
import path from "node:path"

import { formatDiagnostic } from "./diagnostics.ts"
import type { Diagnostic } from "./diagnostics.ts"
import { Driver } from "./driver.ts"
import { SCRIPT_FILE, SKIPPED, sources } from "./host.ts"
import type { NativeBinding } from "./native.ts"

export type DevOptions = {
  native?: NativeBinding
  /** Watches a directory recursively, calling back with changed paths relative to it (tests replace it). */
  watch?: (
    directory: string,
    listener: (name: string) => void
  ) => { close: () => void }
  /** How long to gather changes before compiling them, in milliseconds. */
  delay?: number
}

export type DevSession = {
  /** 0 when the arguments were valid; the session watches until closed. */
  code: number
  /** Compiles what changed since the last call (the watcher calls it after `delay`). */
  flush: () => void
  close: () => void
}

const recursive = (
  directory: string,
  listener: (name: string) => void
): FSWatcher =>
  fsWatch(directory, { recursive: true }, (_, name) => listener(String(name)))

/** Whether a changed path, relative to a watched directory, is a script the session compiles. */
export function compiled(name: string): boolean {
  const parts = name.split(/[\\/]/)
  return (
    SCRIPT_FILE.test(name) &&
    !name.endsWith(".d.ts") &&
    !parts.some((part) => SKIPPED.has(part) || part.startsWith("."))
  )
}

export async function runDev(
  argv: readonly string[],
  root: string,
  write: (text: string) => void,
  options: DevOptions = {}
): Promise<DevSession> {
  const idle: DevSession = { code: 2, flush() {}, close() {} }
  const paths: string[] = []
  let out = "kirana.css"
  let minify = false
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!
    if (argument === "--out") {
      const value = argv[++index]
      if (!value) {
        write("--out needs a file\n")
        return idle
      }
      out = value
    } else if (argument === "--minify") minify = true
    else if (argument.startsWith("-")) {
      write(
        `unknown option ${argument}\nusage: kirana-style dev [paths] [--out <file>] [--minify]\n`
      )
      return idle
    } else paths.push(argument)
  }
  if (paths.length === 0)
    paths.push(existsSync(path.join(root, "src")) ? "src" : ".")
  const directories = paths.map((entry) => path.resolve(root, entry))
  const missing = directories.find((directory) => !existsSync(directory))
  if (missing) {
    write(`${path.relative(root, missing)} does not exist\n`)
    return idle
  }
  const target = path.resolve(root, out)
  const driver = await Driver.create({ root, native: options.native })
  /** What this pass printed: a class-map module under `paths` reports through both. */
  let printed = new Set<string>()
  const report = (
    diagnostics: readonly Diagnostic[],
    sourceOf: (file: string) => string | undefined
  ) => {
    for (const diagnostic of diagnostics) {
      const text = formatDiagnostic(diagnostic, sourceOf(diagnostic.file))
      if (!printed.has(text)) write(`${text}\n`)
      printed.add(text)
    }
  }

  let stylesheet: string | undefined
  let classes: string | undefined
  /** Writes `text` to `file` when it changed since the last write, and says so. */
  const save = (
    file: string,
    text: string,
    previous: string | undefined,
    reason: string,
    started: number
  ) => {
    if (text === previous) return
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
    const elapsed = Math.round(performance.now() - started)
    write(
      `✓ ${path.relative(root, file)} (${text.length} bytes, ${reason}, ${elapsed} ms)\n`
    )
  }
  const compile = (
    files: readonly string[],
    started: number,
    reason: string
  ) => {
    const texts = new Map<string, string>()
    printed = new Set()
    for (const file of files) {
      if (!existsSync(file)) {
        driver.remove(file)
        continue
      }
      const text = readFileSync(file, "utf8")
      texts.set(path.relative(root, file).replaceAll("\\", "/"), text)
      report(driver.transform(file, text, { map: false }).diagnostics, (name) =>
        texts.get(name)
      )
    }
    // The class map compiles its modules first, so the stylesheet holds their atoms.
    const map = driver.classMap()
    if (map) {
      report(
        map.diagnostics,
        (name) => texts.get(name) ?? readFileSync(path.join(root, name), "utf8")
      )
      save(map.out, map.json, classes, reason, started)
      classes = map.json
    }
    report(driver.diagnostics(), () => undefined)
    const css = driver.stylesheet(minify)
    save(target, css, stylesheet, reason, started)
    stylesheet = css
  }

  const started = performance.now()
  const files = directories.flatMap((directory) => sources(directory))
  compile(files, started, `${files.length} file(s)`)

  const pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (pending.size === 0) return
    const at = performance.now()
    const changed = [...pending]
    pending.clear()
    // A changed module, and every module that read a value from it.
    const affected = new Set(
      changed.flatMap((file) => [file, ...driver.invalidate(file)])
    )
    const names = changed.map((file) => path.relative(root, file)).join(", ")
    compile([...affected], at, names)
  }
  // The class map's modules are watched too, wherever they are: a file through its folder.
  const watched = [
    ...new Set([
      ...directories,
      ...driver.classModules
        .filter((module) => existsSync(module))
        .map((module) =>
          SCRIPT_FILE.test(module) ? path.dirname(module) : module
        ),
    ]),
  ]
  const watchers = watched.map((directory) =>
    (options.watch ?? recursive)(directory, (name) => {
      if (!compiled(name)) return
      pending.add(path.join(directory, name))
      clearTimeout(timer)
      timer = setTimeout(flush, options.delay ?? 30)
    })
  )
  write(`watching ${paths.join(", ")}\n`)
  return {
    code: 0,
    flush,
    close() {
      clearTimeout(timer)
      for (const watcher of watchers) watcher.close()
    },
  }
}
