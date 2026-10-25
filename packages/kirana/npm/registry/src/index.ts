/**
 * `@kirana-style/registry`: the commands `kirana-style ui` runs (KRN-DX-020, D-103) and the component
 * registry's format (D-107), with its schemas, its types and the checks that read them. The CLI
 * resolves this package from the project and calls `main` with the arguments after `ui`.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"

import { check } from "./check.ts"

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
export type * from "./types.ts"
export { validate } from "./validate.ts"
export type { Problem } from "./validate.ts"

const USAGE = `Usage: kirana-style ui <command>

Commands in this release:
  validate <file…>   check registry items, indexes and lockfiles: their schema, and every file's hash

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

/** `validate <file…>`: each document's kind, or every problem with it. Exit 1 when one has a problem. */
async function runValidate(
  files: readonly string[],
  cwd: string,
  write: (text: string) => void
): Promise<number> {
  if (files.length === 0) {
    write("kirana-style ui validate needs at least one file\n")
    return 2
  }
  let failed = false
  for (const file of files) {
    let document: unknown
    try {
      document = JSON.parse(await readFile(path.resolve(cwd, file), "utf8"))
    } catch (error) {
      write(`${file}: ${(error as Error).message.split("\n")[0]}\n`)
      failed = true
      continue
    }
    const { kind, problems } = check(document)
    if (problems.length === 0) write(`${file}: a valid ${kind}\n`)
    for (const problem of problems)
      write(`${file}: ${problem.pointer || "/"} ${problem.message}\n`)
    failed ||= problems.length > 0
  }
  return failed ? 1 : 0
}

/** `kirana-style ui <argv…>`: returns the exit code (0, 1 for findings, 2 for a malformed command). */
export async function main(
  argv: readonly string[],
  cwd: string,
  write: (text: string) => void
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
  if (command === "validate") return runValidate(rest, cwd, write)
  if (PLANNED.has(command)) {
    write(`kirana-style ui ${command} is not in this release yet\n`)
    return 1
  }
  write(`kirana-style ui: unknown command ${command}\n\n${USAGE}`)
  return 2
}
