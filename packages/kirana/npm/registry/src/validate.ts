/**
 * Checks a document against one of `schema.ts`'s schemas, in the subset of JSON Schema they use:
 * `type`, `properties`, `patternProperties`, `additionalProperties`, `required`, `minProperties`,
 * `items`, `minItems`, `enum`, `const`, `pattern`, `minLength`, `anyOf`, and `$ref` into the root's
 * `$defs`.
 * A keyword outside it throws, so a schema cannot say more than this checks.
 */
import type { Schema } from "./schema.ts"

/** One thing wrong with a document: where (a JSON pointer, `""` for the root) and what. */
export type Problem = { pointer: string; message: string }

/** Keywords that only describe, and the ones checked. */
const KEYWORDS = new Set([
  "$id",
  "$schema",
  "$defs",
  "title",
  "description",
  "$ref",
  "type",
  "properties",
  "patternProperties",
  "additionalProperties",
  "required",
  "minProperties",
  "items",
  "minItems",
  "enum",
  "const",
  "pattern",
  "minLength",
  "anyOf",
])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const TYPES: Record<
  NonNullable<Schema["type"]>,
  (value: unknown) => boolean
> = {
  object: isObject,
  array: Array.isArray,
  string: (value) => typeof value === "string",
  integer: Number.isInteger,
  boolean: (value) => typeof value === "boolean",
}

/** A key as a JSON pointer writes it (RFC 6901). */
const escape = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1")

const plural = (count: number, noun: string, nouns = `${noun}s`) =>
  `${count} ${count === 1 ? noun : nouns}`

export function validate(document: unknown, root: Schema): Problem[] {
  const problems: Problem[] = []
  const report = (pointer: string, message: string) =>
    problems.push({ pointer, message })

  function resolve(reference: string): Schema {
    const name = reference.startsWith("#/$defs/")
      ? reference.slice("#/$defs/".length)
      : undefined
    const target = name === undefined ? undefined : root.$defs?.[name]
    if (!target) throw new Error(`schema: unresolved $ref ${reference}`)
    return target
  }

  function visit(value: unknown, schema: Schema, pointer: string) {
    for (const keyword of Object.keys(schema))
      if (!KEYWORDS.has(keyword))
        throw new Error(`schema: the keyword ${keyword} is not supported`)
    if (schema.$ref !== undefined) {
      visit(value, resolve(schema.$ref), pointer)
      return
    }
    if (schema.anyOf !== undefined) {
      visitAny(value, schema.anyOf, pointer)
      return
    }
    if (schema.const !== undefined && value !== schema.const) {
      report(pointer, `must be ${JSON.stringify(schema.const)}`)
      return
    }
    if (schema.type !== undefined && !TYPES[schema.type](value)) {
      report(
        pointer,
        `must be ${/^[aeiou]/.test(schema.type) ? "an" : "a"} ${schema.type}`
      )
      return
    }
    if (schema.enum !== undefined && !schema.enum.includes(value as string)) {
      report(pointer, `must be one of ${schema.enum.join(", ")}`)
      return
    }
    if (typeof value === "string") {
      if (schema.minLength !== undefined && value.length < schema.minLength)
        report(
          pointer,
          `must have at least ${plural(schema.minLength, "character")}`
        )
      if (
        schema.pattern !== undefined &&
        !new RegExp(schema.pattern).test(value)
      )
        report(pointer, `must match ${schema.pattern}`)
    } else if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems)
        report(pointer, `must have at least ${plural(schema.minItems, "item")}`)
      if (schema.items !== undefined)
        for (const [index, item] of value.entries())
          visit(item, schema.items, `${pointer}/${index}`)
    } else if (isObject(value)) {
      visitObject(value, schema, pointer)
    }
  }

  /**
   * `anyOf`: valid when one branch is. Otherwise the problems of the first branch whose type the
   * value has (a template string, or the object form), else what the value had to be.
   */
  function visitAny(
    value: unknown,
    branches: readonly Schema[],
    pointer: string
  ) {
    const tries = branches.map((branch) =>
      validate(value, { $defs: root.$defs, ...branch })
    )
    if (tries.some((found) => found.length === 0)) return
    const types = branches.map(
      (branch) =>
        (branch.$ref === undefined ? branch : resolve(branch.$ref)).type
    )
    const fitting = types.findIndex(
      (type) => type === undefined || TYPES[type](value)
    )
    if (fitting < 0) {
      const kinds = types.map(
        (type) => `${/^[aeiou]/.test(type!) ? "an" : "a"} ${type}`
      )
      report(pointer, `must be ${kinds.join(" or ")}`)
      return
    }
    for (const problem of tries[fitting]!)
      report(`${pointer}${problem.pointer}`, problem.message)
  }

  function visitObject(
    value: Record<string, unknown>,
    schema: Schema,
    pointer: string
  ) {
    for (const name of schema.required ?? [])
      if (!(name in value)) report(`${pointer}/${escape(name)}`, "is required")
    const keys = Object.keys(value)
    if (
      schema.minProperties !== undefined &&
      keys.length < schema.minProperties
    )
      report(
        pointer,
        `must have at least ${plural(schema.minProperties, "entry", "entries")}`
      )
    for (const key of keys) {
      const at = `${pointer}/${escape(key)}`
      const own = schema.properties?.[key]
      const patterns = Object.entries(schema.patternProperties ?? {}).filter(
        ([pattern]) => new RegExp(pattern).test(key)
      )
      if (own) visit(value[key], own, at)
      for (const [, matched] of patterns) visit(value[key], matched, at)
      if (own || patterns.length > 0) continue
      if (schema.additionalProperties === false)
        report(at, "is not allowed here")
      else if (schema.additionalProperties)
        visit(value[key], schema.additionalProperties, at)
    }
  }

  visit(document, root, "")
  return problems
}
