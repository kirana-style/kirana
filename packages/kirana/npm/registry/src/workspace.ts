/**
 * `ui` in a workspace (KF-108, D-129): `ui init --workspace packages/ui`, run in an app, makes that
 * package of the workspace the Kirana project the components install into, as shadcn/ui's monorepo
 * has them. The package gets its own `kirana.config.ts` with the `ui` settings, aliases that start
 * with its name (`@workspace/ui/components`), and the tsconfig `paths` that resolve them; the app's
 * configuration names it as `ui.workspace`, and its tsconfig maps the same aliases to the package's
 * source, so the app imports `@workspace/ui/components/button`. Both configurations spread the
 * design system's: the app's build compiles the package's files with the app's own.
 */
import { existsSync } from "node:fs"
import path from "node:path"

import { readJsonc, readPackage } from "@kirana-style/compiler"

import { aliasDirectory, pathsOf } from "./project.ts"
import type { ReadFile } from "./project.ts"
import { packageSettings, SettingsError } from "./settings.ts"
import type { ImportFile, Settings } from "./settings.ts"

/** A project's files as `init` plans them: read as the planned changes leave them. */
export type PlannedFiles = {
  readonly root: string
  readonly read: (file: string) => string | undefined
  readonly write: (file: string, text: string) => void
  /** `read` for an absolute path. */
  readonly absolute: ReadFile
}

/** The root of the workspace at or above `start`: a `workspaces` field or `pnpm-workspace.yaml`. */
export function workspaceRootOf(start: string): string | undefined {
  for (let directory = start; ; directory = path.dirname(directory)) {
    if (
      readPackage(directory).workspaces !== undefined ||
      existsSync(path.join(directory, "pnpm-workspace.yaml"))
    )
      return directory
    if (path.dirname(directory) === directory) return undefined
  }
}

/**
 * The settings `init` works with: `settings` as read, or with `--workspace <directory>` (from the
 * workspace's root, `packages/ui`) the settings of that package for the app at `app`. An app whose
 * `ui.workspace` names another package stops it.
 */
export async function workspaceSettings(
  app: string,
  settings: Settings,
  asked: string | undefined,
  load?: ImportFile
): Promise<Settings> {
  if (asked === undefined) return settings
  const top = workspaceRootOf(app)
  if (top === undefined || top === app)
    throw new SettingsError(
      top === undefined
        ? `kirana-style ui init: --workspace ${asked} needs a workspace: no package.json with workspaces, nor a pnpm-workspace.yaml, at or above ${app}`
        : `kirana-style ui init: --workspace runs in the app that imports the package (apps/web), not at the workspace's root`
    )
  const directory = path.resolve(top, asked)
  if (settings.app !== undefined) {
    if (directory === settings.root) return settings
    throw new SettingsError(
      `${settings.app.file}: ui.workspace names ${path.relative(top, settings.root)}, not ${asked}`
    )
  }
  return packageSettings(directory, { root: app, file: settings.file }, load)
}

/** `path.relative` with forward slashes, as tsconfig paths and imports write it. */
const relative = (from: string, to: string) =>
  path.relative(from, to).split(path.sep).join("/")

/**
 * The tsconfig that takes a new `paths` entry: the one holding the project's `paths`, else the first
 * of `tsconfig.json` and the files it references that has compiler options.
 */
function tsconfigOf(files: PlannedFiles): string | undefined {
  const found = pathsOf(path.join(files.root, "tsconfig.json"), files.absolute)
  if (found) return relative(files.root, found.file)
  const references = [
    ...(files.read("tsconfig.json") ?? "").matchAll(/"path"\s*:\s*"([^"]+)"/g),
  ].map((match) => {
    const target = path.posix.normalize(match[1]!)
    return target.endsWith(".json") ? target : `${target}/tsconfig.json`
  })
  return ["tsconfig.json", ...references].find((file) =>
    /"compilerOptions"\s*:\s*\{/.test(files.read(file) ?? "")
  )
}

/**
 * `pattern` mapped to `target` in the project's tsconfig, unless `alias` resolves already; true when
 * it was added. A package without a tsconfig gets one with the app's JSX options (`app`), so that
 * Vite, TypeScript and Kirana resolve the package's own imports; an app without one is told what to
 * add.
 */
function mapAlias(
  files: PlannedFiles,
  alias: string,
  pattern: string,
  target: string,
  report: string[],
  manual: string[],
  app?: PlannedFiles
): boolean {
  try {
    aliasDirectory(files.root, alias, files.absolute)
    return false
  } catch {
    // Not mapped: below.
  }
  const entry = `"${pattern}": ["${target}"]`
  const file = tsconfigOf(files)
  if (file === undefined) {
    if (app === undefined) {
      manual.push(
        `tsconfig.json: add ${entry} to compilerOptions.paths, so the app resolves the package's files`
      )
      return false
    }
    const options = tsconfigOf(app)
    const { jsx, jsxImportSource } =
      options === undefined
        ? {}
        : // It has compiler options: `tsconfigOf` found it by them.
          (
            readJsonc(app.read(options)!) as {
              compilerOptions: { jsx?: string; jsxImportSource?: string }
            }
          ).compilerOptions
    const compilerOptions = {
      ...(jsx === undefined ? {} : { jsx }),
      ...(jsxImportSource === undefined ? {} : { jsxImportSource }),
      paths: { [pattern]: [target] },
    }
    files.write(
      "tsconfig.json",
      `${JSON.stringify({ compilerOptions, include: ["src"] }, null, 2)}\n`
    )
    report.push(`tsconfig.json: paths ${entry}, its JSX as the app's`)
    return true
  }
  const text = files.read(file)!
  files.write(
    file,
    /"paths"\s*:\s*\{/.test(text)
      ? text.replace(
          /("paths"\s*:\s*\{)(\s*\})?/,
          (_, open: string, empty?: string) =>
            empty === undefined ? `${open} ${entry},` : `${open} ${entry} }`
        )
      : text.replace(
          /"compilerOptions"\s*:\s*\{/,
          (open) => `${open}\n    "paths": { ${entry} },`
        )
  )
  report.push(`${file}: paths ${entry}`)
  return true
}

/**
 * Vite told to read the tsconfig's `paths` (`resolve.tsconfigPaths`), in the config's own `resolve`
 * (Analog's sets `mainFields` there) or a new one; a step by hand where neither can be found.
 */
export function vitePaths(
  files: PlannedFiles,
  report: string[],
  manual: string[]
): void {
  const vite = [
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.js",
    "vite.config.mjs",
  ].find((file) => files.read(file) !== undefined)
  if (vite === undefined || files.read(vite)!.includes("tsconfigPaths")) return
  const text = files.read(vite)!
  const resolve = /\bresolve\s*:\s*\{/
  if (resolve.test(text) || /defineConfig\(\s*\{/.test(text)) {
    files.write(
      vite,
      resolve.test(text)
        ? text.replace(resolve, (open) => `${open} tsconfigPaths: true,`)
        : text.replace(
            /defineConfig\(\s*\{/,
            (open) => `${open}\n  resolve: { tsconfigPaths: true },`
          )
    )
    report.push(`${vite}: resolve: { tsconfigPaths: true }`)
  } else
    manual.push(
      `${vite}: add resolve: { tsconfigPaths: true }, so Vite reads the aliases`
    )
}

/**
 * The aliases of the package `files` holds, resolved in it and in the app: its name's `/*` mapped to
 * its `src` in its own tsconfig and, from the app, in the app's, with Vite told to read them there.
 */
export function prepareWorkspace(
  files: PlannedFiles,
  app: PlannedFiles,
  settings: Settings,
  report: string[],
  manual: string[],
  appReport: string[],
  appManual: string[]
): void {
  const { name } = readPackage(files.root) as { name: string }
  const pattern = `${name}/*`
  const alias = settings.aliases.ui!
  mapAlias(files, alias, pattern, "./src/*", report, manual, app)
  const source = `${relative(app.root, files.root)}/src/*`
  if (mapAlias(app, alias, pattern, source, appReport, appManual))
    vitePaths(app, appReport, appManual)
}

/** What a workspace's lines say first: where the components install, from the working directory. */
export function workspaceLine(settings: Settings, cwd: string): string {
  const { name } = readPackage(settings.root) as { name: string }
  return `workspace: ui installs into ${relative(cwd, settings.root)} (${name}), as ui.workspace names it\n`
}
