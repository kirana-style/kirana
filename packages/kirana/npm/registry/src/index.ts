/**
 * `@kirana-style/registry`: the commands `kirana-style ui` runs (KRN-DX-020, D-103) and the component
 * registry's format (D-107), with its schemas, its types and the checks that read them. The CLI
 * resolves this package from the project and calls `main` with the arguments after `ui`.
 */
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { check } from "./check.ts"
import {
  expectation,
  fetchJson,
  fetchReference,
  RegistryError,
} from "./read.ts"
import type { Io } from "./read.ts"
import { REFERENCE_PATTERN } from "./schema.ts"
import { loadSettings, SettingsError } from "./settings.ts"
import type { ImportFile, Settings } from "./settings.ts"

export { check, hashOf, kindOf } from "./check.ts"
export type { Kind } from "./check.ts"
export {
  FILE_TYPES,
  FRAMEWORKS,
  INDEX_SCHEMA,
  ITEM_SCHEMA,
  ITEM_TYPES,
  LOCKFILE_SCHEMA,
  NAMESPACE_PATTERN,
  REFERENCE_PATTERN,
} from "./schema.ts"
export type { Schema } from "./schema.ts"
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
export { KIRANA_REGISTRY, loadSettings, SettingsError } from "./settings.ts"
export type { ImportFile, Registry, Settings } from "./settings.ts"
export type * from "./types.ts"
export { validate } from "./validate.ts"
export type { Problem } from "./validate.ts"

const USAGE = `Usage: kirana-style ui <command>

Commands in this release:
  validate <document…>   check registry items, indexes and lockfiles: their schema, and every file's
                         hash; a document is a file, a URL, or an item of the project's registries
                         (@acme/card, button for @kirana's, @acme/index for an index)

Coming in later releases: view, search, init, add, diff, update, outdated, remove, preset, build, mcp.
`

/** The commands the registry will have (its plan), so that one asked for early says so. */
const PLANNED = new Set([
  "view",
  "search",
  "init",
  "add",
  "diff",
  "update",
  "outdated",
  "remove",
  "preset",
  "build",
  "mcp",
])

/** This package's version, from its own manifest, in the workspace as in the published package. */
async function version(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  ) as { version: string }
  return manifest.version
}

/** Everything `main` needs from outside: tests replace the network, the environment and the loader. */
export type Options = Io & { load?: ImportFile }

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
      if (
        error instanceof SettingsError ||
        (error as Error).name === "ConfigLoadError"
      ) {
        write(`${(error as Error).message}\n`)
        return 2
      }
      // A URL's own failure already names it.
      const { message } = error as Error
      write(
        message.startsWith(target) ? `${message}\n` : `${target}: ${message}\n`
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
  if (PLANNED.has(command)) {
    write(`kirana-style ui ${command} is not in this release yet\n`)
    return 1
  }
  write(`kirana-style ui: unknown command ${command}\n\n${USAGE}`)
  return 2
}
