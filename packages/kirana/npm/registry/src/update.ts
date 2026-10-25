/**
 * `kirana-style ui update [item…]` and `ui remove <item…>` (KRN-DX-031), on the lockfile's record
 * (KRN-DX-025). An update writes what the registry changed and keeps what the project changed: a
 * file both changed stops it, since the lockfile keeps hashes, not the content to merge from; `diff`
 * shows both sides and `--overwrite` takes the registry's. A removal deletes the files the project
 * left as they were installed, and refuses an item another installed item needs.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"

import { installCommand } from "@kirana-style/compiler"

import {
  checkWritten,
  installPackages,
  missingPackages,
  place,
  plan,
} from "./add.ts"
import type { Placed, Planned } from "./add.ts"
import { hashOf } from "./check.ts"
import { failureLine, parseArgs } from "./command.ts"
import type { Options } from "./command.ts"
import { writeLockfile } from "./lockfile.ts"
import { parseReference, read } from "./read.ts"
import {
  changedInPlace,
  installedKey,
  installedProject,
  isOutdated,
  statusOf,
} from "./status.ts"
import type { Item, Locked } from "./types.ts"

/** `update [item…]`: every outdated item by default. */
export async function runUpdate(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs("update", args, [
    "--dry-run",
    "--overwrite",
    "--no-check",
  ])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  const found = await installedProject(cwd, options)
  if (typeof found === "string") {
    write(`${found}\n`)
    return 2
  }
  const { settings, project, lockfile } = found
  const { statuses, failures } = await statusOf(
    parsed.rest,
    settings,
    project,
    lockfile,
    options
  )
  for (const failure of failures) write(failureLine(failure))
  const refused = statuses.filter(changedInPlace)
  for (const status of refused)
    write(
      `${status.key} ${status.locked.version}: the registry changed its files without a new version; refused (KRN-DX-025)\n`
    )
  const outdated = statuses.filter(
    (status) => isOutdated(status) && !changedInPlace(status)
  )
  if (outdated.length === 0) {
    if (failures.length === 0 && refused.length === 0)
      write(`${statuses.length} item(s), all up to date\n`)
    return failures.length > 0 || refused.length > 0 ? 1 : 0
  }

  // Items an update newly needs are installed with it.
  let added: Placed[]
  let newcomers: Planned[]
  try {
    newcomers = (
      await plan(
        outdated.map((status) => status.key),
        settings,
        project,
        options
      )
    ).filter((planned) => lockfile.items[planned.key] === undefined)
    added = place(newcomers, settings, project, undefined, false)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 1
  }

  const writes: Placed[] = [...added]
  const deletes: string[] = []
  const conflicts: string[] = []
  for (const status of outdated) {
    write(`${status.key} ${status.locked.version} → ${status.item.version}\n`)
    for (const file of status.files) {
      if (file.registry === "same") {
        if (file.project !== "same")
          write(`  ~ ${file.relative}: yours, kept\n`)
        continue
      }
      const theirs = file.project === "changed"
      if (file.registry === "removed") {
        if (theirs)
          write(`  ~ ${file.relative}: no longer the item's; yours, kept\n`)
        else if (file.project === "same") {
          deletes.push(path.join(project.root, file.relative))
          write(`  - ${file.relative}\n`)
        }
        continue
      }
      if (theirs && !parsed.flags.has("--overwrite")) {
        conflicts.push(file.relative)
        write(`  ! ${file.relative}: you and the registry both changed it\n`)
        continue
      }
      writes.push(file.next!)
      write(`  + ${file.relative}\n`)
    }
  }
  for (const newcomer of newcomers) {
    write(`${newcomer.key} ${newcomer.item.version}: newly needed\n`)
    for (const file of added.filter((entry) => entry.item === newcomer.key))
      write(`  + ${file.relative}\n`)
  }

  const packages = missingPackages(
    [
      ...outdated.map((status) => ({
        packages: packagesOf(status.item, status.locked),
      })),
      ...newcomers,
    ],
    project,
    writes
  )
  const commands = installCommand(project.manager, packages, [])
  for (const command of commands) write(`packages: ${command}\n`)
  if (conflicts.length > 0) {
    write(
      `${conflicts.length} file(s) changed on both sides: nothing written; kirana-style ui diff shows them, --overwrite takes the registry's\n`
    )
    return 1
  }
  if (parsed.flags.has("--dry-run")) {
    write("dry run: nothing written\n")
    return 0
  }
  for (const file of writes) {
    writeFileSync(file.destination, file.content)
  }
  // Each was found as installed, so it is there.
  for (const file of deletes) unlinkSync(file)
  if (!installPackages(commands, project, write, options)) return 1
  for (const status of outdated) {
    const files: Locked["files"] = {}
    for (const file of status.files) {
      const was = status.locked.files[file.relative]
      if (writes.some((entry) => entry.relative === file.relative))
        files[file.relative] = {
          source: file.next!.file.hash,
          written: hashOf(file.next!.content),
        }
      else if (file.registry === "same" && was) files[file.relative] = was
    }
    lockfile.items[status.key] = {
      ...status.locked,
      version: status.item.version,
      files,
    }
  }
  for (const newcomer of newcomers) {
    const files: Locked["files"] = {}
    for (const file of added.filter((entry) => entry.item === newcomer.key))
      files[file.relative] = {
        source: file.file.hash,
        written: hashOf(file.content),
      }
    lockfile.items[newcomer.key] = {
      registry: newcomer.template,
      version: newcomer.item.version,
      ...(newcomer.framework === undefined
        ? {}
        : { framework: newcomer.framework, base: newcomer.base! }),
      files,
    }
  }
  writeLockfile(project.root, lockfile)
  write(
    `kirana-style.lock.json: ${outdated.length + newcomers.length} item(s) recorded\n`
  )
  if (parsed.flags.has("--no-check"))
    return failures.length > 0 || refused.length > 0 ? 1 : 0
  const checked = await checkWritten(writes, project.root, write)
  return checked && failures.length === 0 && refused.length === 0 ? 0 : 1
}

/** An item's packages and its installed base's, as the lockfile records the base. */
function packagesOf(item: Item, locked: Locked): Record<string, string> {
  const base =
    locked.framework === undefined
      ? undefined
      : item.frameworks?.[locked.framework]?.[locked.base!]
  return { ...item.dependencies, ...base?.dependencies }
}

/** `remove <item…>`: the files the project left as installed, and the lockfile's entries. */
export async function runRemove(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs("remove", args, ["--dry-run"])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  if (parsed.rest.length === 0) {
    write("kirana-style ui remove needs at least one item\n")
    return 2
  }
  const found = await installedProject(cwd, options)
  if (typeof found === "string") {
    write(`${found}\n`)
    return 2
  }
  const { settings, project, lockfile } = found
  const keys = parsed.rest.map((reference) => installedKey(reference, lockfile))
  const missing = keys.filter((key) => lockfile.items[key] === undefined)
  if (missing.length > 0) {
    write(`${missing.join(", ")}: not installed (kirana-style.lock.json)\n`)
    return 1
  }
  // Who still needs them: every other installed item, as its registry has it now.
  const needs: string[] = []
  for (const [key, locked] of Object.entries(lockfile.items)) {
    if (keys.includes(key)) continue
    let item: Item
    try {
      item = (await read(key, settings, options)).document as Item
    } catch (error) {
      write(`${key}: ${(error as Error).message}\n`)
      return 1
    }
    const { namespace } = parseReference(key)
    const base =
      locked.framework === undefined
        ? undefined
        : item.frameworks?.[locked.framework]?.[locked.base!]
    for (const dependency of [
      ...(item.registryDependencies ?? []),
      ...(base?.registryDependencies ?? []),
    ]) {
      const full = dependency.startsWith("@")
        ? dependency
        : `${namespace}/${dependency}`
      if (keys.includes(full)) needs.push(`${key} needs ${full}`)
    }
  }
  if (needs.length > 0) {
    write(`${needs.join("\n")}\nnothing removed\n`)
    return 1
  }
  for (const key of keys) {
    write(`${key}\n`)
    for (const [relative, { written }] of Object.entries(
      lockfile.items[key]!.files
    )) {
      const file = path.join(project.root, relative)
      if (!existsSync(file)) continue
      if (hashOf(readFileSync(file, "utf8")) !== written) {
        write(`  ~ ${relative}: yours, kept\n`)
        continue
      }
      write(`  - ${relative}\n`)
      if (!parsed.flags.has("--dry-run")) unlinkSync(file)
    }
  }
  if (parsed.flags.has("--dry-run")) {
    write("dry run: nothing removed\n")
    return 0
  }
  for (const key of keys) delete lockfile.items[key]
  writeLockfile(project.root, lockfile)
  write(`kirana-style.lock.json: ${keys.length} item(s) removed\n`)
  return 0
}
