/**
 * The Driver (KRN-INT-001): owns configuration, the compiler session and change tracking.
 * Host adapters only translate their host's API into these calls.
 */
import path from "node:path"

import MagicString from "magic-string"
import type { SourceMap } from "magic-string"

import type { KiranaConfig } from "@kirana-style/core/config"

import {
  hostRoot,
  importFile,
  resolveConfig,
  resolveConfigSync,
} from "./config.ts"
import type { ImportFile } from "./config.ts"
import type { Diagnostic } from "./diagnostics.ts"
import type {
  DesignSystemExport,
  RelationInfo,
  Site,
  TailwindLowering,
  TokenInfo,
  TraceAnswer,
  TraceQuery,
} from "./inspect.ts"
import { parseDiagnostics } from "./diagnostics.ts"
import type { Engine, NativeBinding } from "./native.ts"
import { engineOf, loadNative } from "./native.ts"
import { compiledLibraries, compilesModule } from "./host.ts"
import { compileComponent } from "./sfc.ts"

export type DriverOptions = {
  /** Project root; defaults to the current working directory. */
  root?: string
  /** Options that override `kirana.config.*`. */
  config?: KiranaConfig
  /** The native binding (tests inject one). */
  native?: NativeBinding
  /**
   * How `kirana.config.*` and framework parsers are imported (tests; see `loadConfigFile`: Vitest's
   * module runner gives the default no `import()`).
   */
  importModule?: ImportFile
}

/** How one module is compiled. */
export type TransformOptions = {
  /** Whether to build the source map; `true` unless the host writes none. */
  map?: boolean
}

export type TransformResult = {
  code?: string
  map?: string
  diagnostics: Diagnostic[]
  cssChanged: boolean
  dependencies: string[]
}

/** A native transform result as the Driver hands it on. */
function toResult(result: {
  code?: string | null
  map?: string | null
  diagnostics: string
  cssChanged: boolean
  dependencies: string[]
}): TransformResult {
  return {
    code: result.code ?? undefined,
    map: result.map ?? undefined,
    diagnostics: parseDiagnostics(result.diagnostics),
    cssChanged: result.cssChanged,
    dependencies: result.dependencies,
  }
}

export class Driver {
  /**
   * The project root: the one asked for, or the package root above it that holds the configuration
   * (`hostRoot`). Project diagnostics name their files from it.
   */
  readonly root: string
  readonly configFile: string | undefined
  /** The class-name prefix (`names.prefix`). */
  readonly prefix: string
  /** Which engine compiles: the native addon, or the WASI fallback (KRN-INT-006). */
  readonly engine: Engine
  /**
   * Installed packages compiled as the application's own (KRN-INT-008): Kirana's own style
   * packages (`KIRANA_LIBRARIES`), then the configuration's `libraries`.
   */
  readonly libraries: readonly string[]
  /** The class map's modules (`classes.modules`), absolute; empty without one (D-069). */
  readonly classModules: readonly string[]
  readonly #compiler: InstanceType<NativeBinding["Compiler"]>
  readonly #import: ImportFile
  /** Each component's block modules, by component file (Vue, Svelte, Astro). */
  readonly #components = new Map<string, string[]>()

  private constructor(
    root: string,
    configFile: string | undefined,
    compiler: InstanceType<NativeBinding["Compiler"]>,
    prefix: string,
    load: ImportFile,
    engine: Engine,
    libraries: readonly string[],
    classModules: readonly string[]
  ) {
    this.root = root
    this.configFile = configFile
    this.prefix = prefix
    this.engine = engine
    this.libraries = compiledLibraries(libraries)
    this.classModules = classModules
    this.#compiler = compiler
    this.#import = load
  }

  /** Loads configuration and opens a session; invalid configuration throws with diagnostics. */
  static async create(options: DriverOptions = {}): Promise<Driver> {
    // Absolute, so the configuration module, the engine and the class map resolve from it alike.
    const root = hostRoot(path.resolve(options.root ?? process.cwd()))
    const { file, json } = await resolveConfig(
      root,
      options.config,
      options.importModule
    )
    return Driver.#open(root, file, json, options)
  }

  /**
   * `create` for hosts whose hooks are synchronous (Jest's `process`): the configuration module is
   * loaded with `require()`.
   */
  static createSync(
    options: DriverOptions & { requireModule?: (file: string) => unknown } = {}
  ): Driver {
    // Absolute, so the configuration module, the engine and the class map resolve from it alike.
    const root = hostRoot(path.resolve(options.root ?? process.cwd()))
    const { file, json } = resolveConfigSync(
      root,
      options.config,
      options.requireModule
    )
    return Driver.#open(root, file, json, options)
  }

  static #open(
    root: string,
    file: string | undefined,
    json: string,
    options: DriverOptions
  ): Driver {
    const native = options.native ?? loadNative()
    const resolved = JSON.parse(json) as {
      names?: { prefix?: string }
      libraries?: string[]
      classes?: { modules: string[] }
    }
    return new Driver(
      root,
      file,
      new native.Compiler(json),
      resolved.names?.prefix ?? "k",
      options.importModule ?? importFile,
      engineOf(native),
      resolved.libraries ?? [],
      (resolved.classes?.modules ?? []).map((module) =>
        path.resolve(root, module)
      )
    )
  }

  /**
   * Compiles one module (KRN-CMP-007). `map: false` leaves its source map out: a host that writes
   * none (a build without source maps, a linter, a stylesheet-only host) asks for none, since the
   * map copies the whole module and is about a tenth of a compile.
   */
  transform(
    id: string,
    code: string,
    options: TransformOptions = {}
  ): TransformResult {
    return toResult(this.#compiler.transform(id, code, options.map))
  }

  /**
   * `transform` on a worker thread, so a bundler that runs module hooks concurrently compiles
   * modules in parallel. The WASI engine compiles on the calling thread, as `transform` does.
   */
  async transformAsync(
    id: string,
    code: string,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    if (this.engine !== "native") return this.transform(id, code, options)
    return toResult(await this.#compiler.transformAsync(id, code, options.map))
  }

  /** Whether a module is this application's to compile (its own, or a listed library's). */
  compiles(id: string): boolean {
    return compilesModule(id, this.libraries)
  }

  /**
   * Compiles a Vue, Svelte or Astro component (`design-notes/sfc-masking.md`): its script blocks as
   * modules of their own, its `sx` bindings into runtime spreads.
   */
  async transformComponent(
    file: string,
    source: string
  ): Promise<TransformResult> {
    const result = await compileComponent({
      file,
      source,
      root: this.root,
      prefix: this.prefix,
      compile: (id, code) => this.transform(id, code),
      load: this.#import,
    })
    // A block that is gone (a removed `<script setup>`) leaves the build graph.
    for (const id of this.#components.get(file) ?? []) {
      if (!result.modules.includes(id)) this.#compiler.remove(id)
    }
    this.#components.set(file, result.modules)
    const { modules: _, ...rest } = result
    return rest
  }

  /** The stylesheet for every module compiled so far. A finished bundle uses `finishedStylesheet`. */
  stylesheet(minify: boolean): string {
    return this.#compiler.stylesheet(minify)
  }

  /**
   * Compiles each module once for the session: a transform of a module whose source, and every
   * file its evaluation read, are unchanged returns the previous result. A build compiles the same
   * modules for the client and again for the server, and a dev server or a watch build sends
   * unchanged ones again (KF-063). A module that missed an import is compiled each time, as without
   * reuse, since a file created later could be the one it names.
   */
  reuseTransforms(): void {
    this.#compiler.reuseTransforms()
  }

  /**
   * Starts a dense build (D-084): from now on every module marks the names the compiler writes into
   * it, and `dense` renames those and nothing else. Call it before the first transform.
   */
  markDense(): void {
    this.#compiler.markDense()
  }

  /**
   * The stylesheet of a finished bundle (D-086): a variable token that only code names, and no rule
   * reads, is written when `named` holds it (every token the bundle's chunks and other stylesheets
   * still name) or it is declared `runtime: true`. Also returns the tokens left out, which a later
   * chunk must not name. With `dense`, in dense names (D-084).
   */
  finishedStylesheet(
    named: Iterable<string>,
    dense = false
  ): { css: string; pruned: { variable: string; identity: string }[] } {
    const { css, pruned } = this.#compiler.finishedStylesheet(true, [...named])
    return { css: dense ? this.#compiler.denseRename(css) : css, pruned }
  }

  /**
   * `code` with dense names (D-084) and, when `map`, a source map of the renaming, or `undefined`
   * when it names no Kirana class. Codes are assigned on first sight and kept for the session, so a
   * chunk renamed early stays valid while later modules compile. `source` is the name the map gives
   * the input. A build that writes no map asks for none (KF-061), and the engine then renames the
   * chunk in one pass rather than sending every edit here: 1.7 instead of 6.6 ms on a module of a
   * thousand components (16,000 edits).
   */
  dense(
    code: string,
    source: string,
    map = true
  ): { code: string; map?: SourceMap } | undefined {
    if (!map) {
      const renamed = this.#compiler.denseChunk(code)
      return renamed === null ? undefined : { code: renamed }
    }
    const { starts, ends, texts } = this.#compiler.denseEdits(code)
    if (starts.length === 0) return undefined
    const magic = new MagicString(code)
    starts.forEach((start, index) =>
      magic.overwrite(start, ends[index]!, texts[index]!)
    )
    return {
      code: magic.toString(),
      map: magic.generateMap({
        source,
        hires: "boundary",
        includeContent: true,
      }),
    }
  }

  /**
   * The class map for server templates (D-069): `classes.modules` compiled, and the class string of
   * every handle they export. `undefined` without `classes`.
   */
  classMap():
    | { out: string; json: string; diagnostics: Diagnostic[] }
    | undefined {
    const map = this.#compiler.classMap()
    return map
      ? { ...map, diagnostics: parseDiagnostics(map.diagnostics) }
      : undefined
  }

  /** Project-wide diagnostics. */
  diagnostics(): Diagnostic[] {
    return parseDiagnostics(this.#compiler.diagnostics())
  }

  /**
   * Compiles every source file under `paths` (files or directories, relative to the root) into the
   * session, as `kirana-style check` does; returns every diagnostic, project-wide ones included.
   */
  check(paths: readonly string[]): Diagnostic[] {
    return parseDiagnostics(
      this.#compiler.check(paths.map((entry) => path.resolve(this.root, entry)))
    )
  }

  /** The style sites of a module this session transformed (KRN-DX-002). */
  sites(id: string): Site[] {
    return JSON.parse(this.#compiler.sites(id)) as Site[]
  }

  /** Every token the session has evaluated, inlined ones included. */
  tokens(): TokenInfo[] {
    return JSON.parse(this.#compiler.tokens()) as TokenInfo[]
  }

  /**
   * The project file `specifier` resolves to from the module `from`, as the build resolves it, or
   * undefined for an installed package the application does not compile (one not in `libraries`)
   * or a specifier that does not resolve.
   */
  resolve(from: string, specifier: string): string | undefined {
    return this.#compiler.resolve(from, specifier) ?? undefined
  }

  /** Every relation the session has seen declared, with where it is anchored and read. */
  relations(): RelationInfo[] {
    return JSON.parse(this.#compiler.relations()) as RelationInfo[]
  }

  /**
   * Which value wins for each `{ file, line, property }`, as `kirana-style trace --format json`
   * answers, compiling each file once however many queries name it.
   */
  trace(queries: readonly TraceQuery[]): TraceAnswer[] {
    const resolved = queries.map((query) => ({
      ...query,
      file: path.resolve(this.root, query.file),
    }))
    const answers = JSON.parse(this.#compiler.trace(resolved)) as TraceAnswer[]
    return answers.map((answer, index) => ({
      ...answer,
      file: queries[index]!.file,
    }))
  }

  /**
   * The design system declared under `paths` (the project root when empty), as `kirana-style
   * export` prints it; with `definitions`, what each exported style and recipe evaluates to.
   */
  export(
    paths: readonly string[] = [],
    { definitions = false }: { definitions?: boolean } = {}
  ): DesignSystemExport {
    return JSON.parse(
      this.#compiler.export(
        paths.map((entry) => path.resolve(this.root, entry)),
        definitions
      )
    ) as DesignSystemExport
  }

  /**
   * A Tailwind class string lowered as `kirana-style migrate tailwind` lowers a `className` in
   * `file` (relative to the root): token imports are written as that file would write them. Throws
   * when the configuration has no utility grammar.
   */
  lowerTailwind(classes: string, file = "index.tsx"): TailwindLowering {
    return JSON.parse(
      this.#compiler.lowerTailwind(path.resolve(this.root, file), classes)
    ) as TailwindLowering
  }

  /**
   * A file changed; returns the files whose output may have to be recompiled. A component stands for
   * its block modules, and a block module reported back is named by its component.
   */
  invalidate(id: string): string[] {
    const affected = (this.#components.get(id) ?? [id]).flatMap((module) =>
      this.#compiler.invalidate(module)
    )
    return [...new Set(affected.map((module) => this.#owner(module)))]
  }

  /** A module (or component) left the build graph; returns whether the stylesheet changed. */
  remove(id: string): boolean {
    const modules = this.#components.get(id) ?? [id]
    this.#components.delete(id)
    return modules.map((module) => this.#compiler.remove(module)).some(Boolean)
  }

  /** The component a block module belongs to, or the module itself. */
  #owner(module: string): string {
    for (const [component, modules] of this.#components) {
      if (modules.includes(module)) return component
    }
    return module
  }
}
