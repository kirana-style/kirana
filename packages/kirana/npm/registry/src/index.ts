/**
 * `@kirana-style/registry`: the commands `kirana-style ui` runs (KRN-DX-020, D-103) and the component
 * registry's format (D-107), with its schemas, its types and the checks that read them. The CLI
 * resolves this package from the project and calls `main` with the arguments after `ui`.
 */
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { runAdd } from "./add.ts"
import { runInit } from "./init.ts"
import { runDiff, runOutdated } from "./status.ts"
import { runPreset } from "./preset.ts"
import { runRemove, runUpdate } from "./update.ts"
import { version } from "./version.ts"
import { check } from "./check.ts"
import { failureLine, isSettingsError } from "./command.ts"
import type { Options } from "./command.ts"
import {
  expectation,
  fetchJson,
  fetchReference,
  RegistryError,
} from "./read.ts"
import { REFERENCE_PATTERN } from "./schema.ts"
import { runSearch } from "./search.ts"
import { loadSettings } from "./settings.ts"
import type { Settings } from "./settings.ts"
import { runView } from "./view.ts"

export { check, hashOf, kindOf } from "./check.ts"
export type { Kind } from "./check.ts"
export type { Failure, Options, Run } from "./command.ts"
export { changedInPlace, isOutdated, statusOf } from "./status.ts"
export type { FileStatus, ItemStatus } from "./status.ts"
export {
  installPackages,
  missingPackages,
  place,
  placeOf,
  plan,
  planItem,
  record,
  writePlaced,
} from "./add.ts"
export type { Placed, Planned } from "./add.ts"
export { resolveIcons } from "./icons.ts"
export { LOCKFILE, readLockfile, writeLockfile } from "./lockfile.ts"
export {
  attributesOf,
  decodePreset,
  documentOf,
  setUi,
  settingsOf,
  withAttributes,
} from "./preset.ts"
export { aliasDirectory, frameworkOf, readProject } from "./project.ts"
export type { Project } from "./project.ts"
export {
  FILE_TYPES,
  FRAMEWORKS,
  INDEX_SCHEMA,
  ITEM_SCHEMA,
  ITEM_TYPES,
  LOCKFILE_SCHEMA,
  NAMESPACE_PATTERN,
  ALIASED_TYPES,
  ICON_LIBRARIES,
  REFERENCE_PATTERN,
  SETTINGS_SCHEMA,
} from "./schema.ts"
export type { Schema } from "./schema.ts"
export { matches } from "./search.ts"
export type { Result } from "./search.ts"
export {
  DEFAULT_TIMEOUT,
  expandHeaders,
  fetchJson,
  fetchReference,
  locate,
  parseReference,
  read,
  registryOf,
  RegistryError,
} from "./read.ts"
export type { Io } from "./read.ts"
export {
  DEFAULT_ALIASES,
  KIRANA_REGISTRY,
  loadSettings,
  SettingsError,
} from "./settings.ts"
export type { AliasedType, ImportFile, Registry, Settings } from "./settings.ts"
export type * from "./types.ts"
export { validate } from "./validate.ts"
export type { Problem } from "./validate.ts"

const USAGE = `Usage: kirana-style ui <command>
       npx @kirana-style/registry <command>   (where no project has the package yet)

Commands in this release:
  init                   set a project up for a registry: Kirana where it is missing, the ui settings
                         (--framework, --base, --registry @namespace=<template>), and the registry's
                         design system (--design <item>) installed and wired in; --template <example>
                         [directory] starts a new project from one of Kirana's examples, --preset
                         <code> sets its design, --all-designs (ui.allDesigns) keeps every other
                         design installed too; --pointer (data-pointer on <html>: buttons get the
                         pointer cursor) and --rtl (dir="rtl" on <html>), --no-pointer and --no-rtl
                         take them off; --dry-run, --overwrite, --no-check
  add <item…>            install items and every item they need: files at the project's aliases
                         (ui.aliases, through tsconfig.json's paths), packages with its package
                         manager, each recorded in kirana-style.lock.json; --dry-run, --overwrite,
                         --no-check
  outdated [item…]       the installed items behind their registries: a new version, or files changed
  diff [item…]           each installed file the registry or the project changed, as lines between
                         the project's and what installing it now would write
  update [item…]         write what the registry changed since install, keep what the project changed;
                         a file both changed stops it (--overwrite takes the registry's); --dry-run,
                         --no-check
  remove <item…>         delete the files the project left as installed, unless another item needs
                         it; --dry-run
  preset <code>          change the project's design: the code read with its design system's layouts,
                         ui.design and <html>'s attributes set, every item placed again for it;
                         --pointer, --rtl, --no-pointer, --no-rtl as init's; --dry-run, --overwrite,
                         --no-check
  view <item…>           what an item is: its frameworks and bases, files, styles and dependencies
                         (@acme/card, or button for @kirana's); --json prints the items as read
  search [query]         the items of every registry's index whose name, title or description holds
                         the query; --registry <namespace> (repeatable) searches only those, --json
  validate <document…>   check registry items, indexes and lockfiles: their schema, and every file's
                         hash; a document is a file, a URL, or an item of the project's registries
                         (@acme/card, button for @kirana's, @acme/index for an index)

--no-check skips the kirana-style check a command runs on the scripts it wrote.

Coming in later releases: build, mcp.
`

/** The commands the registry will have (its plan), so that one asked for early says so. */
const PLANNED = new Set(["build", "mcp"])

/**
 * A document to validate and its JSON: a URL is fetched as it is; a file is read; a registry
 * reference (`@acme/card`) is fetched with its registry's headers, when no file has that name.
 */
async function documentOf(
  target: string,
  cwd: string,
  settings: () => Promise<Settings>,
  options: Options
): Promise<{ document: unknown; reference?: string }> {
  if (/^(https?|file):/i.test(target))
    return { document: await fetchJson(new URL(target), {}, options) }
  const file = path.resolve(cwd, target)
  if (!existsSync(file) && REFERENCE_PATTERN.test(target)) {
    const { document } = await fetchReference(target, await settings(), options)
    return { document, reference: target }
  }
  try {
    return { document: JSON.parse(await readFile(file, "utf8")) }
  } catch (error) {
    throw new RegistryError((error as Error).message.split("\n")[0]!)
  }
}

/**
 * `validate <document…>`: each document's kind, or every problem with it, and for a reference
 * whether it is what was asked for. Exit 1 when one has a problem or cannot be read, 2 without a
 * document or when the project's `ui` settings cannot be used.
 */
async function runValidate(
  targets: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options
): Promise<number> {
  if (targets.length === 0) {
    write("kirana-style ui validate needs at least one document\n")
    return 2
  }
  let loaded: Promise<Settings> | undefined
  const settings = () => (loaded ??= loadSettings(cwd, options.load))
  let failed = false
  for (const target of targets) {
    let found: { document: unknown; reference?: string }
    try {
      found = await documentOf(target, cwd, settings, options)
    } catch (error) {
      if (isSettingsError(error)) {
        write(`${(error as Error).message}\n`)
        return 2
      }
      // A URL's own failure already names it.
      write(
        failureLine({ document: target, message: (error as Error).message })
      )
      failed = true
      continue
    }
    const { kind, problems } = check(found.document)
    const wrong =
      found.reference === undefined
        ? undefined
        : expectation(found.reference, found.document, kind)
    if (wrong !== undefined) problems.unshift({ pointer: "", message: wrong })
    if (problems.length === 0) write(`${target}: a valid ${kind}\n`)
    for (const problem of problems)
      write(`${target}: ${problem.pointer || "/"} ${problem.message}\n`)
    failed ||= problems.length > 0
  }
  return failed ? 1 : 0
}

/** `kirana-style ui <argv…>`: returns the exit code (0, 1 for findings, 2 for a malformed command). */
export async function main(
  argv: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const [command, ...rest] = argv
  if (command === undefined || ["help", "--help", "-h"].includes(command)) {
    write(USAGE)
    return 0
  }
  if (command === "--version" || command === "-v") {
    write(`@kirana-style/registry ${await version()}\n`)
    return 0
  }
  if (command === "validate") return runValidate(rest, cwd, write, options)
  if (command === "view") return runView(rest, cwd, write, options)
  if (command === "add") return runAdd(rest, cwd, write, options)
  if (command === "init") return runInit(rest, cwd, write, options)
  if (command === "outdated") return runOutdated(rest, cwd, write, options)
  if (command === "diff") return runDiff(rest, cwd, write, options)
  if (command === "update") return runUpdate(rest, cwd, write, options)
  if (command === "remove") return runRemove(rest, cwd, write, options)
  if (command === "preset") return runPreset(rest, cwd, write, options)
  if (command === "search") return runSearch(rest, cwd, write, options)
  if (PLANNED.has(command)) {
    write(`kirana-style ui ${command} is not in this release yet\n`)
    return 1
  }
  write(`kirana-style ui: unknown command ${command}\n\n${USAGE}`)
  return 2
}
