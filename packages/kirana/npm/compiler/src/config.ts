/**
 * Configuration loading (KRN-INT-001, KRN-CMP-013): the Driver evaluates `kirana.config.*` once
 * and hands the engine plain JSON.
 */
import { existsSync, readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { createRequire } from "node:module"
import type { LoadHookSync } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type { KiranaConfig, UtilityGrammar } from "@kirana-style/core/config"

import {
  engineJson as toEngineJson,
  mergeGrammars as mergeEngineGrammars,
} from "./engine-json.ts"
import type { JsxMode } from "./engine-json.ts"

const CANDIDATES = [
  "kirana.config.ts",
  "kirana.config.mts",
  "kirana.config.js",
  "kirana.config.mjs",
  "kirana.config.json",
]

/**
 * `import()` where no bundler looks: webpack's persistent cache parses every module the Next.js
 * configuration loads and warns on every build about an `import()` of a non-literal ("Build
 * dependencies behind this expression are ignored"). The configuration is read at run time, never a
 * build dependency, so hiding the call loses nothing; it also keeps `vite-plus/pack` from rewriting it.
 */
export const importFile = new Function(
  "url",
  "return import(url)"
) as ImportFile

/** Loads a configuration module by file URL. */
export type ImportFile = (url: string) => Promise<unknown>

/** The configuration file in `root`, if any. */
function findConfigFile(root: string): string | undefined {
  return CANDIDATES.map((name) => path.join(root, name)).find((file) =>
    existsSync(file)
  )
}

/**
 * The nearest configuration file at or above `start` (a directory), as TypeScript finds a
 * `tsconfig.json`; undefined when no directory up to the file system's root has one.
 */
export function findConfigAbove(start: string): string | undefined {
  for (let directory = start; ; directory = path.dirname(directory)) {
    const file = findConfigFile(directory)
    if (file) return file
    if (path.dirname(directory) === directory) return undefined
  }
}

/**
 * The root a host's Driver compiles from: `root`, unless it has no configuration and sits in a
 * package whose root has one: Vite's `root` is often a folder of the package, while `kirana-style ui
 * init` writes `kirana.config.ts` beside `package.json` (KF-069). The configuration's directory is
 * then the root, as `--config <file>` makes it, so the paths it names resolve from where it is.
 */
export function hostRoot(root: string): string {
  for (let directory = root; ; directory = path.dirname(directory)) {
    if (findConfigFile(directory)) return directory
    const top =
      existsSync(path.join(directory, "package.json")) ||
      path.dirname(directory) === directory
    if (top) return root
  }
}

/**
 * A configuration file that could not be loaded: which file, and what failed in it, instead of
 * Node.js's stack (KF-016).
 */
export class ConfigLoadError extends Error {
  readonly file: string

  constructor(file: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    const missing = /Cannot find (?:module|package) '([^']+)'/.exec(reason)?.[1]
    const relative =
      missing !== undefined &&
      path.isAbsolute(missing) &&
      path.extname(missing) === ""
    super(
      missing === undefined
        ? `loading ${file}: ${reason.split("\n")[0]}`
        : `loading ${file}: ${missing} not found` +
            (relative
              ? "; Node.js loads the configuration without a bundler, so its relative imports, and theirs, need their extension (`./states.ts`)"
              : "")
    )
    this.name = "ConfigLoadError"
    this.file = file
  }
}

/** An `import` or `export` statement at a line's start, which CommonJS cannot hold. */
const MODULE_SYNTAX = /^[ \t]*(?:import[ \t]*[\w{*"']|export[ \t])/m

/**
 * A `.ts` file Node.js reads as CommonJS, because its package says `"type": "commonjs"` (as
 * `npm init` writes), is loaded as an ES module when it has `import` or `export` statements: as
 * CommonJS it could only fail, and a package without `"type"` would load it so.
 */
export const moduleTypeScript: LoadHookSync = (url, context, nextLoad) => {
  const loaded = nextLoad(url, context)
  return loaded.format === "commonjs-typescript" &&
    MODULE_SYNTAX.test(String(loaded.source))
    ? { ...loaded, format: "module-typescript" }
    : loaded
}

type RegisterHooks = typeof nodeModule.registerHooks

/** Node.js's `registerHooks`; undefined on Bun and Deno. */
const REGISTER_HOOKS = (nodeModule as { registerHooks?: RegisterHooks })
  .registerHooks

/**
 * `moduleTypeScript` in Node.js's module hooks, which `import()` and `require()` both go through, so
 * the configuration and the files it imports load as they are written; `deregister` ends it. Bun
 * and Deno load TypeScript as written and have no `registerHooks`: nothing to do there.
 */
export function moduleHooks(register: RegisterHooks | undefined): {
  deregister: () => void
} {
  return register?.({ load: moduleTypeScript }) ?? { deregister: () => {} }
}

/** Runs `load` inside `moduleHooks`. */
async function asWritten<T>(load: () => T | Promise<T>): Promise<T> {
  const hooks = moduleHooks(REGISTER_HOOKS)
  try {
    return await load()
  } finally {
    hooks.deregister()
  }
}

/** `asWritten` for the synchronous loader. */
function asWrittenSync<T>(load: () => T): T {
  const hooks = moduleHooks(REGISTER_HOOKS)
  try {
    return load()
  } finally {
    hooks.deregister()
  }
}

/** A configuration module's default export, or a JSON file's content. */
function configOf(file: string, module: () => unknown): KiranaConfig {
  if (file.endsWith(".json"))
    return JSON.parse(readFileSync(file, "utf8")) as KiranaConfig
  return (module() as { default?: KiranaConfig }).default ?? {}
}

/** Finds and evaluates the configuration file in `root`, if any. */
export async function loadConfigFile(
  root: string,
  /** Tests pass `(url) => import(url)`: Vitest's module runner gives `Function` code no `import()`. */
  load: ImportFile = importFile
): Promise<{ file?: string; config: KiranaConfig }> {
  const file = findConfigFile(root)
  if (!file) return { config: {} }
  return { file, config: await loadConfig(file, load) }
}

/** Evaluates one configuration file; a failure is a `ConfigLoadError` naming it. */
async function loadConfig(
  file: string,
  load: ImportFile
): Promise<KiranaConfig> {
  try {
    const module = file.endsWith(".json")
      ? undefined
      : await asWritten(() => importOrRequire(file, load))
    return configOf(file, () => module)
  } catch (error) {
    throw new ConfigLoadError(file, error)
  }
}

/**
 * The configuration module, by `import()`, or by `require()` where the host gives `Function` code
 * no `import()`: a CommonJS project whose bundler `require()`s Kirana's ES-module loader (webpack's
 * loader runner in Docusaurus) fails with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. `require()`
 * reads ES modules and strips TypeScript on current Node.js, as `resolveConfigSync` relies on.
 */
async function importOrRequire(
  file: string,
  load: ImportFile
): Promise<unknown> {
  try {
    return await load(pathToFileURL(file).href)
  } catch (error) {
    if (
      (error as { code?: string }).code !==
      "ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING"
    )
      throw error
    return createRequire(file)(file)
  }
}

/** The JSON the engine receives: file configuration, overridden key by key by inline options. */
export async function resolveConfig(
  root: string,
  inline: KiranaConfig = {},
  load?: ImportFile
): Promise<{ file?: string; json: string }> {
  const { file, config } = await loadConfigFile(root, load)
  return { file, json: engineJson(root, config, inline) }
}

/**
 * `resolveConfig` for one configuration file (`kirana-style check --config <file>`): its directory
 * is the root.
 */
export async function resolveConfigFile(
  file: string,
  load: ImportFile = importFile
): Promise<{ file: string; json: string }> {
  const root = path.dirname(file)
  return { file, json: engineJson(root, await loadConfig(file, load), {}) }
}

/**
 * `resolveConfig` for hosts whose hooks are synchronous (Jest's `process`): the configuration module
 * is loaded with `require()`, which reads ES modules and strips TypeScript on current Node.js.
 */
export function resolveConfigSync(
  root: string,
  inline: KiranaConfig = {},
  load: (file: string) => unknown = createRequire(import.meta.url)
): { file?: string; json: string } {
  const file = findConfigFile(root)
  const config = file
    ? configOf(file, () => asWrittenSync(() => load(file)))
    : {}
  return { file, json: engineJson(root, config, inline) }
}

/** The engine's JSON for a project on disk: `jsx` detected from its `tsconfig.json`. */
function engineJson(
  root: string,
  config: KiranaConfig,
  inline: KiranaConfig
): string {
  return toEngineJson(root, config, inline, {
    // Detected only when the configuration names none: a named mode wins.
    jsx: ({ ...config, ...inline }.jsx ?? detectJsx(root)) as
      | JsxMode
      | undefined,
    resolveModule: path.resolve,
  })
}

/** `mergeGrammars` with relative scale modules resolved by Node.js's `path.resolve`. */
export function mergeGrammars(
  grammars: readonly (UtilityGrammar | undefined)[],
  root: string
): UtilityGrammar | undefined {
  return mergeEngineGrammars(grammars, root, path.resolve)
}

/** `jsxImportSource` values that mean a framework other than React. */
const JSX_SOURCES: Readonly<Record<string, "preact" | "solid" | "qwik">> = {
  preact: "preact",
  "solid-js": "solid",
  "solid-js/h": "solid",
  "@qwik.dev/core": "qwik",
  "@builder.io/qwik": "qwik",
}

/** The end of the JSON string that opens at `start`, past its escapes: the closing quote's index. */
function stringEnd(text: string, start: number): number {
  let at = start + 1
  for (; at < text.length && text[at] !== '"'; at++) if (text[at] === "\\") at++
  return at
}

/**
 * JSON with comments and trailing commas, as `tsconfig.json` is written: comments out, then commas
 * before a closing bracket, each in one pass that keeps strings as they are, so no input makes it
 * slow (a regular expression for it backtracks).
 */
export function readJsonc(text: string): unknown {
  let bare = ""
  for (let at = 0; at < text.length; at++) {
    if (text[at] === '"') {
      const end = stringEnd(text, at)
      bare += text.slice(at, end + 1)
      at = end
    } else if (text.startsWith("//", at)) {
      const end = text.indexOf("\n", at)
      at = end < 0 ? text.length : end - 1
    } else if (text.startsWith("/*", at)) {
      const end = text.indexOf("*/", at + 2)
      at = end < 0 ? text.length : end + 1
    } else bare += text[at]
  }
  let json = ""
  for (let at = 0; at < bare.length; at++) {
    if (bare[at] === '"') {
      const end = stringEnd(bare, at)
      json += bare.slice(at, end + 1)
      at = end
      continue
    }
    if (bare[at] === ",") {
      let next = at + 1
      while (next < bare.length && /\s/.test(bare[next]!)) next++
      if (bare[next] === "}" || bare[next] === "]") continue
    }
    json += bare[at]
  }
  return JSON.parse(json)
}

/**
 * The `jsx` mode `tsconfig.json`'s `compilerOptions.jsxImportSource` implies (KRN-INT-004), or
 * undefined for React and when there is no readable `tsconfig.json`. Comments and trailing commas,
 * which `tsconfig.json` allows, are removed before parsing; `extends` is not followed.
 */
export function detectJsx(
  root: string
): "preact" | "solid" | "qwik" | undefined {
  const file = path.join(root, "tsconfig.json")
  if (!existsSync(file)) return undefined
  try {
    const source = (
      readJsonc(readFileSync(file, "utf8")) as {
        compilerOptions?: { jsxImportSource?: string }
      }
    ).compilerOptions?.jsxImportSource
    return source === undefined ? undefined : JSX_SOURCES[source]
  } catch {
    return undefined
  }
}
