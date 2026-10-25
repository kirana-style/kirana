/**
 * What a registry document is and everything wrong with it: its schema's problems, then what a
 * schema cannot say (KRN-DX-021, KRN-DX-024): each file's hash against its content, and a `target`
 * on exactly the files of type `file`.
 */
import { createHash } from "node:crypto"

import { INDEX_SCHEMA, ITEM_SCHEMA, LOCKFILE_SCHEMA } from "./schema.ts"
import type { Item, RegistryFile } from "./types.ts"
import { validate } from "./validate.ts"
import type { Problem } from "./validate.ts"

export type Kind = "item" | "index" | "lockfile"

const SCHEMAS = {
  item: ITEM_SCHEMA,
  index: INDEX_SCHEMA,
  lockfile: LOCKFILE_SCHEMA,
} as const

/** A file's integrity hash: `sha256-` and the base64 SHA-256 of its UTF-8 bytes. */
export function hashOf(content: string): string {
  return `sha256-${createHash("sha256").update(content, "utf8").digest("base64")}`
}

/**
 * Which document this is: what its `$schema` names, else its shape (a lockfile has a
 * `lockfileVersion`, an index an `items` list); anything else is read as an item.
 */
export function kindOf(document: unknown): Kind {
  if (typeof document !== "object" || document === null) return "item"
  const record = document as Record<string, unknown>
  const declared = typeof record.$schema === "string" ? record.$schema : ""
  if (declared.endsWith("/lockfile.json") || "lockfileVersion" in record)
    return "lockfile"
  if (declared.endsWith("/registry-index.json") || Array.isArray(record.items))
    return "index"
  return "item"
}

/** The files of an item, each with its JSON pointer. */
function filesOf(item: Item): [string, RegistryFile][] {
  const found: [string, RegistryFile][] = []
  const add = (pointer: string, files: RegistryFile[] = []) =>
    files.forEach((file, index) => found.push([`${pointer}/${index}`, file]))
  add("/styles", item.styles)
  add("/files", item.files)
  for (const [framework, bases] of Object.entries(item.frameworks ?? {}))
    for (const [base, entry] of Object.entries(bases))
      add(`/frameworks/${framework}/${base}/files`, entry.files)
  return found
}

/** What the item schema cannot check: hashes, and targets. */
function fileProblems(item: Item): Problem[] {
  const problems: Problem[] = []
  for (const [pointer, file] of filesOf(item)) {
    if (file.type === "file" && file.target === undefined)
      problems.push({
        pointer: `${pointer}/target`,
        message: "is required for a file of type file",
      })
    if (file.type !== "file" && file.target !== undefined)
      problems.push({
        pointer: `${pointer}/target`,
        message: `is only for a file of type file; a ${file.type} installs under its alias`,
      })
    const actual = hashOf(file.content)
    if (actual !== file.hash)
      problems.push({
        pointer: `${pointer}/hash`,
        message: `does not match the content, whose hash is ${actual}`,
      })
  }
  return problems
}

/** The document's kind and its problems, in document order; none when it is valid. */
export function check(document: unknown): { kind: Kind; problems: Problem[] } {
  const kind = kindOf(document)
  const problems = validate(document, SCHEMAS[kind])
  if (kind === "item" && problems.length === 0)
    problems.push(...fileProblems(document as Item))
  return { kind, problems }
}
