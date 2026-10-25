/**
 * `kirana-style ui add <item…>` (KRN-DX-028, D-108): each item and every item it needs, read and
 * checked (KRN-DX-026), its framework's and base's markup chosen, every file placed under the
 * project's alias for its type with its `@/registry/` imports rewritten to those aliases, the npm
 * packages added with the project's package manager, and each item recorded in the lockfile
 * (KRN-DX-025). Nothing is written when a file the project has would change, unless `--overwrite`.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { installCommand } from "@kirana-style/compiler"

import { hashOf } from "./check.ts"
import { parseArgs } from "./command.ts"
import type { Options, Run } from "./command.ts"
import { readLockfile, writeLockfile } from "./lockfile.ts"
import { aliasDirectory, frameworkOf, readProject } from "./project.ts"
import type { Project } from "./project.ts"
import { parseReference, read, RegistryError, registryOf } from "./read.ts"
import { REFERENCE_PATTERN } from "./schema.ts"
import { loadSettings } from "./settings.ts"
import type { AliasedType, Settings } from "./settings.ts"
import type {
  Framework,
  Item,
  Locked,
  Packages,
  RegistryFile,
} from "./types.ts"

/** An item to install: where it came from, the markup chosen, and what it needs. */
export type Planned = {
  /** `@namespace/name`. */
  key: string
  template: string
  item: Item
  framework?: Framework
  base?: string
  /** The item's files and its base's, in the order they install. */
  files: RegistryFile[]
  packages: Packages
}

/** A file about to be written, and how it stands against the project's. */
export type Placed = {
  item: string
  file: RegistryFile
  /** Absolute; `relative` is from the project's root, with forward slashes. */
  destination: string
  relative: string
  content: string
  state: "new" | "same" | "differs"
}

const IMPORT = /(["'])@\/registry\/([a-z]+)\/([^"']+)\1/g

/** The full reference of a dependency named in an item of `namespace`: a bare name is its registry's. */
const qualify = (dependency: string, namespace: string) =>
  dependency.startsWith("@") ? dependency : `${namespace}/${dependency}`

/** The framework and base whose markup the project gets, or why it cannot get any. */
function chooseBase(
  key: string,
  item: Item,
  framework: Framework | undefined,
  base: string | undefined
): { framework?: Framework; base?: string } {
  if (!item.frameworks) return {}
  const supported = Object.entries(item.frameworks)
    .map(([name, bases]) => `${name} (${Object.keys(bases!).join(", ")})`)
    .join(", ")
  if (framework === undefined)
    throw new RegistryError(
      `${key} has markup for ${supported}: set ui.framework in kirana.config`
    )
  const bases = item.frameworks[framework]
  if (!bases)
    throw new RegistryError(
      `${key} has no markup for ${framework}: it supports ${supported}`
    )
  const names = Object.keys(bases)
  if (base !== undefined && names.includes(base)) return { framework, base }
  if (base === undefined && names.length === 1)
    return { framework, base: names[0]! }
  throw new RegistryError(
    base === undefined
      ? `${key} has several ${framework} bases (${names.join(", ")}): set ui.base in kirana.config`
      : `${key} has no ${framework} markup for the base ${base}: it has ${names.join(", ")}`
  )
}

/**
 * The items to install, each after the items it needs, every item read once. A reference that is not
 * an item, or one whose markup the project cannot take, stops it.
 */
export async function plan(
  references: readonly string[],
  settings: Settings,
  project: Project,
  options: Options = {}
): Promise<Planned[]> {
  const framework = settings.framework ?? frameworkOf(project)
  const planned: Planned[] = []
  const visited = new Set<string>()
  const visit = async (reference: string) => {
    if (!REFERENCE_PATTERN.test(reference))
      throw new RegistryError(
        `${reference} is not an item: @namespace/name, or a name for @kirana's`
      )
    const { namespace, name } = parseReference(reference)
    const key = `${namespace}/${name}`
    if (visited.has(key)) return
    visited.add(key)
    const found = await read(key, settings, options)
    if (found.kind === "index")
      throw new RegistryError(`${key} is an index, not an item`)
    const item = found.document as Item
    const chosen = chooseBase(key, item, framework, settings.base)
    const entry =
      chosen.framework === undefined
        ? undefined
        : item.frameworks![chosen.framework]![chosen.base!]!
    for (const dependency of [
      ...(item.registryDependencies ?? []),
      ...(entry?.registryDependencies ?? []),
    ])
      await visit(qualify(dependency, namespace))
    planned.push({
      key,
      template: registryOf(namespace, settings).template,
      item,
      ...chosen,
      files: [
        ...(item.files ?? []),
        ...(item.styles ?? []),
        ...(entry?.files ?? []),
      ],
      packages: { ...item.dependencies, ...entry?.dependencies },
    })
  }
  for (const reference of references) await visit(reference)
  return planned
}

/** The place a file names: `ui/button.tsx` as `ui/button`, an `index` by its folder too. */
const placeOf = (type: string, file: string) =>
  `${type}/${file.replace(/\.[cm]?[jt]sx?$|\.vue$|\.svelte$/, "")}`

/**
 * Every file at its destination with its imports rewritten, and how it stands against what the
 * project has. An import of `@/registry/<type>/<path>` that no planned file provides, or of a type
 * without an alias, stops it.
 */
export function place(
  planned: readonly Planned[],
  settings: Settings,
  project: Project
): Placed[] {
  const directories = new Map<string, string>()
  const directoryOf = (type: AliasedType, key: string) => {
    const alias = settings.aliases[type]
    if (alias === undefined)
      throw new RegistryError(
        `${key} installs a ${type} file: set ui.aliases.${type} in kirana.config`
      )
    let directory = directories.get(alias)
    if (directory === undefined) {
      directory = aliasDirectory(project.root, alias)
      directories.set(alias, directory)
    }
    return directory
  }
  const provided = new Set<string>()
  for (const { files } of planned)
    for (const file of files)
      if (file.type !== "file") {
        provided.add(placeOf(file.type, file.path))
        provided.add(placeOf(file.type, file.path).replace(/\/index$/, ""))
      }
  const placed: Placed[] = []
  const taken = new Map<string, string>()
  for (const { key, files } of planned)
    for (const file of files) {
      const content = file.content.replace(
        IMPORT,
        (_, quote: string, type: string, rest: string) => {
          const alias = settings.aliases[type as AliasedType]
          if (type === "file" || alias === undefined)
            throw new RegistryError(
              `${key}: ${file.path} imports @/registry/${type}/${rest}, a type without an alias`
            )
          if (!provided.has(placeOf(type, rest)))
            throw new RegistryError(
              `${key}: ${file.path} imports @/registry/${type}/${rest}, which no item being installed provides`
            )
          return `${quote}${alias}/${rest}${quote}`
        }
      )
      const destination =
        file.type === "file"
          ? path.resolve(project.root, file.target!)
          : path.join(directoryOf(file.type, key), file.path)
      const relative = path
        .relative(project.root, destination)
        .split(path.sep)
        .join("/")
      const owner = taken.get(destination)
      if (owner !== undefined)
        throw new RegistryError(`${key} and ${owner} both install ${relative}`)
      taken.set(destination, key)
      const current = existsSync(destination)
        ? readFileSync(destination, "utf8")
        : undefined
      placed.push({
        item: key,
        file,
        destination,
        relative,
        content,
        state:
          current === undefined
            ? "new"
            : current === content
              ? "same"
              : "differs",
      })
    }
  return placed
}

/** The packages the items need that the project does not list, as `name@range`. */
export function missingPackages(
  planned: readonly Planned[],
  project: Project
): string[] {
  const needed = new Map<string, string>()
  for (const { packages } of planned)
    for (const [name, range] of Object.entries(packages))
      if (!(name in project.listed)) needed.set(name, range)
  return [...needed].map(([name, range]) => `${name}@${range}`).sort()
}

/** The package manager's command in a shell, its output shown; a signal counts as a failure. */
export const runInShell: Run = (command, cwd) =>
  spawnSync(command, { cwd, shell: true, stdio: "inherit" }).status ?? 1

/**
 * `add <item…>`: plans, refuses or writes, installs packages, records the lockfile. Exit 1 when an
 * item cannot be read or installed, 2 without an item, for an unknown option, or with settings it
 * cannot use.
 */
export async function runAdd(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs("add", args, ["--dry-run", "--overwrite"])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  if (parsed.rest.length === 0) {
    write("kirana-style ui add needs at least one item\n")
    return 2
  }
  let settings: Settings
  try {
    settings = await loadSettings(cwd, options.load)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 2
  }
  const project = readProject(settings.root)
  let planned: Planned[]
  let placed: Placed[]
  let lockfile
  try {
    planned = await plan(parsed.rest, settings, project, options)
    placed = place(planned, settings, project)
    lockfile = readLockfile(project.root)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 1
  }
  const marks = { new: "+", same: "=", differs: "!" } as const
  for (const { key, item, framework, base } of planned) {
    write(
      `${key} ${item.version}${framework ? ` · ${framework}/${base}` : ""}\n`
    )
    for (const file of placed.filter((entry) => entry.item === key))
      write(`  ${marks[file.state]} ${file.relative}\n`)
  }
  const packages = missingPackages(planned, project)
  const commands = installCommand(project.manager, packages, [])
  for (const command of commands) write(`packages: ${command}\n`)
  const conflicts = placed.filter((file) => file.state === "differs")
  if (conflicts.length > 0 && !parsed.flags.has("--overwrite")) {
    write(
      `${conflicts.length} file(s) the project has would change (!): nothing written; --overwrite replaces them\n`
    )
    return 1
  }
  if (parsed.flags.has("--dry-run")) {
    write("dry run: nothing written\n")
    return 0
  }
  for (const file of placed)
    if (file.state !== "same") {
      mkdirSync(path.dirname(file.destination), { recursive: true })
      writeFileSync(file.destination, file.content)
    }
  const run = options.run ?? runInShell
  for (const command of commands)
    if (run(command, project.root) !== 0) {
      write(`${command} failed: the files are written, the lockfile is not\n`)
      return 1
    }
  for (const { key, template, item, framework, base } of planned) {
    const files: Locked["files"] = {}
    for (const file of placed.filter((entry) => entry.item === key))
      files[file.relative] = {
        source: file.file.hash,
        written: hashOf(file.content),
      }
    lockfile.items[key] = {
      registry: template,
      version: item.version,
      ...(framework === undefined ? {} : { framework, base }),
      files,
    }
  }
  writeLockfile(project.root, lockfile)
  write(`kirana-style.lock.json: ${planned.length} item(s) recorded\n`)
  return 0
}
