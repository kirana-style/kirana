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
  for (const [value, bases] of Object.entries(item.flattened?.builds ?? {}))
    for (const [base, files] of Object.entries(bases))
      add(`/flattened/builds/${value}/${base}`, files)
  for (const [axis, values] of Object.entries(item.flattened?.axes ?? {}))
    for (const [value, files] of Object.entries(values))
      add(`/flattened/axes/${axis}/${value}`, files)
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

/** The package a module specifier is in: `@scope/name` or `name`, without its path. */
const packageOf = (specifier: string) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/")

/**
 * What the item schema cannot check across fields (KF-050): a font item names its font and the
 * package its stylesheet is in, and only a font item has one; an axis build replaces a file the
 * item installs (KF-080); an axis names items only for its own values.
 */
function itemProblems(item: Item): Problem[] {
  const problems: Problem[] = []
  if (item.type === "font" && item.font === undefined)
    problems.push({ pointer: "/font", message: "is required for a font item" })
  if (item.type !== "font" && item.font !== undefined)
    problems.push({
      pointer: "/font",
      message: `is only for a font item; this one is a ${item.type}`,
    })
  if (
    item.font !== undefined &&
    !(packageOf(item.font.import) in (item.dependencies ?? {}))
  )
    problems.push({
      pointer: "/font/import",
      message: `is in ${packageOf(item.font.import)}, which dependencies does not list`,
    })
  // An axis build replaces one of the item's files; one that replaces none would install nothing.
  const own = new Set(
    filesOf(item)
      .filter(([pointer]) => !pointer.startsWith("/flattened/axes/"))
      .map(([, file]) => `${file.type}:${file.path}`)
  )
  for (const [axis, values] of Object.entries(item.flattened?.axes ?? {}))
    for (const [value, files] of Object.entries(values))
      files.forEach((file, index) => {
        if (!own.has(`${file.type}:${file.path}`))
          problems.push({
            pointer: `/flattened/axes/${axis}/${value}/${index}`,
            message: `replaces ${file.type} ${file.path}, which the item does not install`,
          })
      })
  for (const [axis, { values, items }] of Object.entries(
    item.design?.axes ?? {}
  ))
    for (const value of Object.keys(items ?? {}))
      if (!values.includes(value))
        problems.push({
          pointer: `/design/axes/${axis}/items/${value}`,
          message: `names an item for ${value}, which is not one of the axis's values`,
        })
  return problems
}

/** The document's kind and its problems, in document order; none when it is valid. */
export function check(document: unknown): { kind: Kind; problems: Problem[] } {
  const kind = kindOf(document)
  const problems = validate(document, SCHEMAS[kind])
  if (kind === "item" && problems.length === 0)
    problems.push(
      ...itemProblems(document as Item),
      ...fileProblems(document as Item)
    )
  return { kind, problems }
}
