/**
 * A project's registries (KRN-DX-022, KRN-DX-026): `ui.registries` from the nearest
 * `kirana.config.*` at or above the working directory, read with the compiler's own loader and
 * checked against `SETTINGS_SCHEMA` before anything is fetched, with `@kirana` built in.
 */
import path from "node:path"

import { findConfigAbove, loadConfigFile } from "@kirana-style/compiler"

import { SETTINGS_SCHEMA } from "./schema.ts"
import type { ALIASED_TYPES } from "./schema.ts"
import type { Framework } from "./types.ts"
import { validate } from "./validate.ts"

/** Kirana UI's registry, which every project knows without configuring it. */
export const KIRANA_REGISTRY = "https://ui.kirana.style/r/{name}.json"

/** One registry: its namespace, its URL template, and the headers it is read with. */
export type Registry = {
  namespace: string
  template: string
  headers: Readonly<Record<string, string>>
}

/** A file type a project imports through an alias. */
export type AliasedType = (typeof ALIASED_TYPES)[number]

/** shadcn/ui's aliases, which a project without `ui.aliases` gets (`page` has none). */
export const DEFAULT_ALIASES: Readonly<Partial<Record<AliasedType, string>>> = {
  ui: "@/components/ui",
  lib: "@/lib",
  component: "@/components",
  hook: "@/hooks",
}

/** What the commands read from a project. */
export type Settings = {
  /** The configuration's directory, where a path template starts; the working directory without one. */
  root: string
  /** The configuration file, when there is one. */
  file?: string
  registries: ReadonlyMap<string, Registry>
  /** `ui.framework` and `ui.base`, when set. */
  framework?: Framework
  base?: string
  /** The defaults, with `ui.aliases` over them. */
  aliases: Readonly<Partial<Record<AliasedType, string>>>
}

/** Settings that cannot be used: the configuration file and every problem in its `ui`. */
export class SettingsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SettingsError"
  }
}

type RegistryEntry = string | { url: string; headers?: Record<string, string> }

/** Loads a configuration module by file URL; tests pass Node's own `import()`. */
export type ImportFile = (url: string) => Promise<unknown>

export async function loadSettings(
  cwd: string,
  load?: ImportFile
): Promise<Settings> {
  const file = findConfigAbove(cwd)
  const root = file === undefined ? cwd : path.dirname(file)
  const { config } =
    file === undefined ? { config: {} } : await loadConfigFile(root, load)
  const ui = (config as { ui?: unknown }).ui ?? {}
  const problems = validate(ui, SETTINGS_SCHEMA)
  if (problems.length > 0)
    throw new SettingsError(
      problems
        .map((problem) => `${file}: ui${problem.pointer} ${problem.message}`)
        .join("\n")
    )
  const {
    registries: configured,
    framework,
    base,
    aliases,
  } = ui as {
    registries?: Record<string, RegistryEntry>
    framework?: Framework
    base?: string
    aliases?: Partial<Record<AliasedType, string>>
  }
  const registries = new Map<string, Registry>([
    [
      "@kirana",
      { namespace: "@kirana", template: KIRANA_REGISTRY, headers: {} },
    ],
  ])
  for (const [namespace, entry] of Object.entries(configured ?? {}))
    registries.set(
      namespace,
      typeof entry === "string"
        ? { namespace, template: entry, headers: {} }
        : { namespace, template: entry.url, headers: entry.headers ?? {} }
    )
  return {
    root,
    file,
    registries,
    ...(framework === undefined ? {} : { framework }),
    ...(base === undefined ? {} : { base }),
    aliases: { ...DEFAULT_ALIASES, ...aliases },
  }
}
