/**
 * Installed items against their registries (KRN-DX-025, KRN-DX-030): each item read again and
 * placed as installing it now would write it, and each file compared by the lockfile's two hashes,
 * the registry's content (`source`) and what was written (`written`), so a registry's change is told
 * from the project's own edit. `ui outdated`, `ui diff`, `ui update` and `ui remove` read it.
 */
import { existsSync, readFileSync } from "node:fs"

import { diffChange } from "@kirana-style/compiler"

import { place, planItem } from "./add.ts"
import type { Placed, Planned } from "./add.ts"
import { hashOf } from "./check.ts"
import { failureLine, parseArgs } from "./command.ts"
import type { Failure, Options } from "./command.ts"
import { readLockfile } from "./lockfile.ts"
import { readProject } from "./project.ts"
import type { Project } from "./project.ts"
import { parseReference, read, RegistryError } from "./read.ts"
import { loadSettings } from "./settings.ts"
import type { Settings } from "./settings.ts"
import type { Framework, Item, Locked, Lockfile } from "./types.ts"

/** One installed file: whether the registry and the project changed it since it was installed. */
export type FileStatus = {
  relative: string
  /** `added`: the registry has it now, the install did not write it; `removed`: the other way. */
  registry: "same" | "changed" | "added" | "removed"
  /** `missing`: the project no longer has it. */
  project: "same" | "changed" | "missing"
  /** What installing the item now would write; none for a file the registry removed. */
  next?: Placed
  /** The project's file, when it has one. */
  current?: string
  /**
   * Installing it now would write it differently from what was written, the registry's content
   * aside: another icon library, alias or design.
   */
  restyled?: boolean
}

/** One installed item: its version then and now, and its files. */
export type ItemStatus = {
  key: string
  locked: Locked
  item: Item
  /** The item as installing it now would place it: its framework, base and flattened build. */
  planned: Planned
  files: FileStatus[]
}

/** The framework and base an installed item is placed for: by default the ones it was installed with. */
export type Choose = (
  key: string,
  item: Item,
  locked: Locked
) => { framework?: Framework; base?: string }

const asInstalled: Choose = (_, __, locked) =>
  locked.framework === undefined
    ? {}
    : { framework: locked.framework, base: locked.base! }

/** Whether an item is behind its registry: a new version, or a file the registry changed. */
export const isOutdated = (status: ItemStatus) =>
  status.item.version !== status.locked.version ||
  status.files.some((file) => file.registry !== "same")

/** Whether the registry changed an item's files without changing its version, which is refused. */
export const changedInPlace = (status: ItemStatus) =>
  status.item.version === status.locked.version &&
  status.files.some((file) => file.registry !== "same")

/**
 * An installed item as a command names it: `@acme/card`, or a name alone for the one installed item
 * of that name, else `@kirana`'s.
 */
export function installedKey(reference: string, lockfile: Lockfile): string {
  const { namespace, name } = parseReference(reference)
  if (reference.startsWith("@")) return `${namespace}/${name}`
  const found = Object.keys(lockfile.items).filter((key) =>
    key.endsWith(`/${name}`)
  )
  return found.length === 1 ? found[0]! : `${namespace}/${name}`
}

/** Each installed item named (all of them by default) against its registry, or why it cannot be read. */
export async function statusOf(
  keys: readonly string[],
  settings: Settings,
  project: Project,
  lockfile: Lockfile,
  options: Options,
  choose: Choose = asInstalled
): Promise<{ statuses: ItemStatus[]; failures: Failure[] }> {
  const statuses: ItemStatus[] = []
  const failures: Failure[] = []
  const wanted =
    keys.length > 0
      ? keys.map((key) => installedKey(key, lockfile))
      : Object.keys(lockfile.items)
  for (const key of wanted) {
    const locked = lockfile.items[key]
    try {
      if (locked === undefined)
        throw new RegistryError("is not installed (kirana-style.lock.json)")
      const found = await read(key, settings, options)
      const item = found.document as Item
      const planned = planItem(key, item, settings, choose(key, item, locked))
      const placed = place([planned], settings, project, undefined, false)
      const files: FileStatus[] = placed.map((next) => {
        const was = locked.files[next.relative]
        return {
          relative: next.relative,
          registry:
            was === undefined
              ? "added"
              : was.source === next.file.hash
                ? "same"
                : "changed",
          ...projectSide(next.destination, was?.written),
          next,
          restyled: was !== undefined && hashOf(next.content) !== was.written,
        }
      })
      for (const [relative, was] of Object.entries(locked.files))
        if (!placed.some((next) => next.relative === relative))
          files.push({
            relative,
            registry: "removed",
            ...projectSide(`${project.root}/${relative}`, was.written),
          })
      statuses.push({ key, locked, item, planned, files })
    } catch (error) {
      failures.push({ document: key, message: (error as Error).message })
    }
  }
  return { statuses, failures }
}

/** The project's side of a file: its content, and whether it still is what was written. */
function projectSide(
  file: string,
  written: string | undefined
): Pick<FileStatus, "project" | "current"> {
  if (!existsSync(file)) return { project: "missing" }
  const current = readFileSync(file, "utf8")
  return {
    project: hashOf(current) === written ? "same" : "changed",
    current,
  }
}

/** Settings, project and lockfile for a command on installed items, or the message for exit 2. */
export async function installedProject(
  cwd: string,
  options: Options
): Promise<
  { settings: Settings; project: Project; lockfile: Lockfile } | string
> {
  try {
    const settings = await loadSettings(cwd, options.load)
    const project = readProject(settings.root)
    return { settings, project, lockfile: readLockfile(project.root) }
  } catch (error) {
    return (error as Error).message
  }
}

/** `outdated [item…]`: the installed items behind their registries. Exit 1 when one is. */
export async function runOutdated(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs("outdated", args, [])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  const found = await installedProject(cwd, options)
  if (typeof found === "string") {
    write(`${found}\n`)
    return 2
  }
  const { statuses, failures } = await statusOf(
    parsed.rest,
    found.settings,
    found.project,
    found.lockfile,
    options
  )
  const behind = statuses.filter(isOutdated)
  for (const status of behind) {
    const changed = status.files.filter((file) => file.registry !== "same")
    write(
      changedInPlace(status)
        ? `${status.key} ${status.locked.version}: ${changed.length} file(s) changed under the same version, which update refuses\n`
        : `${status.key} ${status.locked.version} → ${status.item.version}${changed.length > 0 ? ` (${changed.length} file(s) changed)` : ""}\n`
    )
  }
  if (behind.length === 0 && failures.length === 0)
    write(`${statuses.length} item(s), all up to date\n`)
  for (const failure of failures) write(failureLine(failure))
  return behind.length > 0 || failures.length > 0 ? 1 : 0
}

/**
 * `diff [item…]`: for each file the registry or the project changed since it was installed, the
 * lines between the project's file and what installing the item now would write.
 */
export async function runDiff(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs("diff", args, [])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  const found = await installedProject(cwd, options)
  if (typeof found === "string") {
    write(`${found}\n`)
    return 2
  }
  const { statuses, failures } = await statusOf(
    parsed.rest,
    found.settings,
    found.project,
    found.lockfile,
    options
  )
  let differences = 0
  for (const status of statuses)
    for (const file of status.files) {
      if (file.registry === "same" && file.project === "same") continue
      differences++
      // A file the registry added is one the project never had: only the registry's side is news.
      const theirs =
        file.registry === "added" && file.project === "missing"
          ? "same"
          : file.project
      const who = [
        ...(file.registry === "same"
          ? []
          : [`the registry ${file.registry} it`]),
        ...(theirs === "same"
          ? []
          : [`the project ${theirs === "missing" ? "removed" : "changed"} it`]),
      ].join(", ")
      write(`${status.key}: ${file.relative}: ${who}\n`)
      write(
        diffChange({
          file: file.relative,
          ...(file.current === undefined ? {} : { before: file.current }),
          after: file.next?.content ?? "",
        })
      )
    }
  if (differences === 0 && failures.length === 0)
    write(`${statuses.length} item(s), no differences\n`)
  for (const failure of failures) write(failureLine(failure))
  return failures.length > 0 ? 1 : 0
}
