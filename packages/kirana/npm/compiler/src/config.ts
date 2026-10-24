/**
 * Configuration loading (KRN-INT-001, KRN-CMP-013): the Driver evaluates `kirana.config.*` once
 * and hands the engine plain JSON.
 */
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type {
  KiranaConfig,
  ScaleSource,
  UtilityGrammar,
  UtilityRule,
} from "@kirana-style/core/config"

const CANDIDATES = [
  "kirana.config.ts",
  "kirana.config.mts",
  "kirana.config.js",
  "kirana.config.mjs",
  "kirana.config.json",
]

/**
 * `import()` where no bundler looks. webpack's persistent cache parses every module the Next.js
 * configuration loads, accepts only string-literal `import()`, and otherwise warns on every build
 * ("Build dependencies behind this expression are ignored"). The configuration file is read by the
 * Driver at run time, never a build dependency a bundler could track, so hiding the call loses
 * nothing. It also keeps the packer (`vite-plus/pack`) from rewriting the import when it compiles.
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
      : await importOrRequire(file, load)
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
  const config = file ? configOf(file, () => load(file)) : {}
  return { file, json: engineJson(root, config, inline) }
}

function engineJson(
  root: string,
  config: KiranaConfig,
  inline: KiranaConfig
): string {
  // `ui` is `kirana-style ui`'s (D-103), never the engine's, which refuses keys it does not know.
  const {
    presets = [],
    utilities,
    ui: _registry,
    ...merged
  } = { ...config, ...inline }
  const jsx = merged.jsx ?? detectJsx(root)
  const grammar = mergeGrammars(
    [...presets.map((preset) => preset.utilities), utilities],
    root
  )
  return JSON.stringify({
    ...merged,
    ...(jsx ? { jsx } : {}),
    ...(grammar ? { utilities: grammar } : {}),
    root,
  })
}

/**
 * The presets' utility grammars and the project's, merged in order: a later scale, root or variant
 * replaces an earlier one of the same name (KRN-TOK-008). A relative scale module is resolved from
 * the project root, since the engine reads it from whichever module uses the utility.
 */
export function mergeGrammars(
  grammars: readonly (UtilityGrammar | undefined)[],
  root: string
): UtilityGrammar | undefined {
  const present = grammars.filter((grammar) => grammar !== undefined)
  if (present.length === 0) return undefined
  const scales: Record<string, ScaleSource[]> = {}
  const utilities: Record<string, readonly UtilityRule[]> = {}
  const variants: Record<string, string> = {}
  for (const grammar of present) {
    for (const [name, sources] of Object.entries(grammar.scales ?? {})) {
      scales[name] = sources.map((source) => ({
        module: /^\.\.?\//.test(source.module)
          ? path.resolve(root, source.module)
          : source.module,
        export: source.export,
      }))
    }
    Object.assign(utilities, grammar.utilities)
    Object.assign(variants, grammar.variants)
  }
  return { scales, utilities, variants }
}

/** `jsxImportSource` values that mean a framework other than React. */
const JSX_SOURCES: Readonly<Record<string, "preact" | "solid" | "qwik">> = {
  preact: "preact",
  "solid-js": "solid",
  "solid-js/h": "solid",
  "@qwik.dev/core": "qwik",
  "@builder.io/qwik": "qwik",
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
    const text = readFileSync(file, "utf8")
      .replace(
        /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
        (_, string) => string ?? ""
      )
      .replace(/,(\s*[}\]])/g, "$1")
    const source = (
      JSON.parse(text) as { compilerOptions?: { jsxImportSource?: string } }
    ).compilerOptions?.jsxImportSource
    return source === undefined ? undefined : JSX_SOURCES[source]
  } catch {
    return undefined
  }
}
