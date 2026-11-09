/**
 * A project's `ui` settings (KRN-DX-022, KRN-DX-026): `ui` from the nearest `kirana.config.*` at
 * or above the working directory, read with the compiler's own loader and checked against
 * `SETTINGS_SCHEMA` before anything is fetched, with the `@kirana` registry built in. An app whose
 * `ui.workspace` names a package of its workspace reads that package's settings instead: the
 * package is the project `ui` installs into (KF-108, D-129).
 */
import path from "node:path"

import {
  findConfigAbove,
  loadConfigFile,
  readPackage,
} from "@kirana-style/compiler"

import { SETTINGS_SCHEMA } from "./schema.ts"
import type { ALIASED_TYPES } from "./schema.ts"
import type { Framework, IconLibrary } from "./types.ts"
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

/**
 * A workspace package's aliases (D-129): its own name where an app's are `@/`, as shadcn/ui's
 * monorepo has them, so the app imports `@workspace/ui/components/button`.
 */
export function workspaceAliases(
  name: string
): Partial<Record<AliasedType, string>> {
  return {
    ui: `${name}/components`,
    lib: `${name}/lib`,
    component: `${name}/components`,
    hook: `${name}/hooks`,
  }
}

/** What the commands read from a project. */
export type Settings = {
  /** The configuration's directory, where a path template starts; the working directory without one. */
  root: string
  /** The configuration file, when there is one. */
  file?: string
  /**
   * In a workspace (D-129): the app whose `ui.workspace` names this package, where the commands run
   * and where the stylesheets, fonts and `<html>` styles are wired; `root` is then the package's.
   */
  app?: { root: string; file?: string }
  registries: ReadonlyMap<string, Registry>
  /** `ui.framework` and `ui.base`, when set. */
  framework?: Framework
  base?: string
  /** `ui.iconLibrary`, Lucide by default, as shadcn/ui's. */
  iconLibrary: IconLibrary
  /** `ui.design`: the design system's axis values the project uses, none by default. */
  design: Readonly<Record<string, string>>
  /** `ui.allDesigns`: style modules and design files as written, every design kept (KF-080). */
  allDesigns?: true
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
  const ui = uiOf(config, file)
  return "workspace" in ui
    ? followed({ root, file }, ui as { workspace: string }, load)
    : settingsOf(root, file, ui)
}

/** The settings of the package the app's `ui.workspace` names, which must have a configuration. */
async function followed(
  app: NonNullable<Settings["app"]>,
  ui: { workspace: string },
  load?: ImportFile
): Promise<Settings> {
  const others = Object.keys(ui).filter((key) => key !== "workspace")
  if (others.length > 0)
    throw new SettingsError(
      `${app.file}: ui.workspace names the package ui installs into: set ${others.join(", ")} in its configuration instead`
    )
  const settings = await packageSettings(
    path.resolve(app.root, ui.workspace),
    app,
    load
  )
  if (settings.file === undefined)
    throw new SettingsError(
      `${app.file}: ui.workspace names ${ui.workspace}, which has no kirana.config: kirana-style ui init --workspace sets it up`
    )
  return settings
}

/**
 * The settings of the workspace package in `directory`, read from its own configuration, for the
 * `app` that names it (D-129): its aliases start with its package name. Without a configuration it
 * has the defaults, as `ui init --workspace` starts from them.
 */
export async function packageSettings(
  directory: string,
  app: NonNullable<Settings["app"]>,
  load?: ImportFile
): Promise<Settings> {
  const { name } = readPackage(directory) as { name?: string }
  if (name === undefined)
    throw new SettingsError(
      `${path.join(directory, "package.json")}: a workspace package needs its name, which its aliases start with`
    )
  const { file, config } = await loadConfigFile(directory, load)
  const ui = uiOf(config, file)
  if ("workspace" in ui)
    throw new SettingsError(
      `${file}: ui.workspace in the package ui installs into: only the app names it`
    )
  return {
    ...settingsOf(directory, file, ui, workspaceAliases(name)),
    app,
  }
}

/** A configuration's `ui`, checked against `SETTINGS_SCHEMA`. */
function uiOf(config: unknown, file: string | undefined): object {
  const ui = (config as { ui?: unknown }).ui ?? {}
  const problems = validate(ui, SETTINGS_SCHEMA)
  if (problems.length > 0)
    throw new SettingsError(
      problems
        .map((problem) => `${file}: ui${problem.pointer} ${problem.message}`)
        .join("\n")
    )
  return ui as object
}

/** The settings a valid `ui` gives, `defaults` under its aliases. */
function settingsOf(
  root: string,
  file: string | undefined,
  ui: object,
  defaults: Partial<Record<AliasedType, string>> = DEFAULT_ALIASES
): Settings {
  const {
    registries: configured,
    framework,
    base,
    iconLibrary,
    design,
    allDesigns,
    aliases,
  } = ui as {
    registries?: Record<string, RegistryEntry>
    framework?: Framework
    base?: string
    iconLibrary?: IconLibrary
    design?: Record<string, string>
    allDesigns?: boolean
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
    iconLibrary: iconLibrary ?? "lucide",
    design: design ?? {},
    ...(allDesigns ? { allDesigns } : {}),
    aliases: { ...defaults, ...aliases },
  }
}
