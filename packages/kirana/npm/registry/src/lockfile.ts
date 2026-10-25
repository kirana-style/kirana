/**
 * `kirana-style.lock.json` (KRN-DX-025): read before a command changes a project, checked against its
 * schema, and written back with its items in a stable order, so a change shows as a small diff.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { RegistryError } from "./read.ts"
import { LOCKFILE_SCHEMA } from "./schema.ts"
import type { Lockfile } from "./types.ts"
import { validate } from "./validate.ts"

export const LOCKFILE = "kirana-style.lock.json"

/** The project's lockfile, or an empty one; one that is not JSON or not valid stops the command. */
export function readLockfile(root: string): Lockfile {
  const file = path.join(root, LOCKFILE)
  if (!existsSync(file)) return { lockfileVersion: 1, items: {} }
  let document: unknown
  try {
    document = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    throw new RegistryError(
      `${LOCKFILE}: not JSON: ${(error as Error).message}`
    )
  }
  const problems = validate(document, LOCKFILE_SCHEMA)
  if (problems.length > 0)
    throw new RegistryError(
      problems
        .map(
          (problem) =>
            `${LOCKFILE}: ${problem.pointer || "/"} ${problem.message}`
        )
        .join("\n")
    )
  return document as Lockfile
}

/** Writes the lockfile, its items and each item's files sorted. */
export function writeLockfile(root: string, lockfile: Lockfile): void {
  const sorted = <T>(record: Record<string, T>) =>
    Object.fromEntries(
      // Keys are unique, so two are never equal.
      Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1))
    )
  const items = sorted(
    Object.fromEntries(
      Object.entries(lockfile.items).map(([key, item]) => [
        key,
        { ...item, files: sorted(item.files) },
      ])
    )
  )
  writeFileSync(
    path.join(root, LOCKFILE),
    `${JSON.stringify({ ...lockfile, items }, null, 2)}\n`
  )
}
