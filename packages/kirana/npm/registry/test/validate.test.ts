import { describe, expect, it } from "vite-plus/test"

import type { Schema } from "../src/schema.ts"
import { validate } from "../src/validate.ts"

describe("validate: the JSON Schema subset the registry's schemas use", () => {
  it("refuses a keyword it does not implement, so a schema cannot say more than is checked", () => {
    expect(() => validate({}, { oneOf: [] } as unknown as Schema)).toThrow(
      "schema: the keyword oneOf is not supported"
    )
  })

  it("follows a $ref into the root's $defs, and throws on one it cannot resolve", () => {
    const root: Schema = {
      $defs: { name: { type: "string" } },
      properties: { a: { $ref: "#/$defs/name" } },
    }
    expect(validate({ a: 1 }, root)).toEqual([
      { pointer: "/a", message: "must be a string" },
    ])
    expect(() => validate(1, { $ref: "#/definitions/name" })).toThrow(
      "schema: unresolved $ref #/definitions/name"
    )
    expect(() => validate(1, { $ref: "#/$defs/missing" })).toThrow(
      "schema: unresolved $ref #/$defs/missing"
    )
  })

  it("checks const, type and enum, stopping at the first a value fails", () => {
    expect(validate(2, { const: 1 })).toEqual([
      { pointer: "", message: "must be 1" },
    ])
    expect(validate(1, { type: "object" })[0]!.message).toBe(
      "must be an object"
    )
    expect(validate([], { type: "object" })[0]!.message).toBe(
      "must be an object"
    )
    expect(validate({}, { type: "array" })[0]!.message).toBe("must be an array")
    expect(validate(1.5, { type: "integer" })[0]!.message).toBe(
      "must be an integer"
    )
    expect(validate("yes", { type: "boolean" })[0]!.message).toBe(
      "must be a boolean"
    )
    expect(validate(true, { type: "boolean" })).toEqual([])
    expect(validate("c", { type: "string", enum: ["a", "b"] })).toEqual([
      { pointer: "", message: "must be one of a, b" },
    ])
  })

  it("checks a string's length and pattern", () => {
    expect(validate("", { minLength: 1 })).toEqual([
      { pointer: "", message: "must have at least 1 character" },
    ])
    expect(validate("a", { minLength: 2, pattern: "^b" })).toEqual([
      { pointer: "", message: "must have at least 2 characters" },
      { pointer: "", message: "must match ^b" },
    ])
  })

  it("checks an array's length and each item, by index", () => {
    expect(validate([], { minItems: 1 })[0]!.message).toBe(
      "must have at least 1 item"
    )
    expect(validate(["a"], { minItems: 2 })[0]!.message).toBe(
      "must have at least 2 items"
    )
    expect(validate(["a", 1], { items: { type: "string" } })).toEqual([
      { pointer: "/1", message: "must be a string" },
    ])
    expect(validate([1], {})).toEqual([])
  })

  it("checks an object's required keys, size, properties, patterns and the rest", () => {
    const schema: Schema = {
      required: ["name"],
      minProperties: 2,
      properties: { name: { type: "string" } },
      patternProperties: { "^x-": { type: "integer" } },
      additionalProperties: false,
    }
    expect(validate({ "x-a": "1", other: true }, schema)).toEqual([
      { pointer: "/name", message: "is required" },
      { pointer: "/x-a", message: "must be an integer" },
      { pointer: "/other", message: "is not allowed here" },
    ])
    expect(validate({ name: "a" }, schema)).toEqual([
      { pointer: "", message: "must have at least 2 entries" },
    ])
    expect(validate({}, { minProperties: 1 })[0]!.message).toBe(
      "must have at least 1 entry"
    )
    expect(
      validate({ a: 1 }, { additionalProperties: { type: "string" } })
    ).toEqual([{ pointer: "/a", message: "must be a string" }])
    expect(validate({ a: 1 }, {})).toEqual([])
  })

  it("writes keys holding ~ and / as a JSON pointer does", () => {
    expect(
      validate({ "a/b~c": 1 }, { additionalProperties: false })[0]!.pointer
    ).toBe("/a~1b~0c")
  })

  it("lets a value with no keyword about its kind pass", () => {
    expect(validate(5, { minLength: 1, minItems: 1, required: ["a"] })).toEqual(
      []
    )
    expect(validate(null, {})).toEqual([])
  })

  it("takes any branch of anyOf, else reports the branch that fits the value's kind", () => {
    const root: Schema = {
      $defs: { template: { type: "string", pattern: "\\{name\\}" } },
      anyOf: [
        { $ref: "#/$defs/template" },
        { type: "object", required: ["url"] },
      ],
    }
    expect(validate("https://a.dev/{name}", root)).toEqual([])
    expect(validate({ url: "x" }, root)).toEqual([])
    expect(validate("https://a.dev", root)).toEqual([
      { pointer: "", message: "must match \\{name\\}" },
    ])
    const nested: Schema = {
      $defs: root.$defs,
      properties: { a: { anyOf: root.anyOf } },
    }
    expect(validate({ headers: {} }, nested)).toEqual([])
    expect(validate({ a: {} }, nested)).toEqual([
      { pointer: "/a/url", message: "is required" },
    ])
    expect(validate(5, root)).toEqual([
      { pointer: "", message: "must be a string or an object" },
    ])
    expect(validate(5, { anyOf: [{}, { type: "string" }] })).toEqual([])
    expect(validate(5, { anyOf: [{ const: 1 }, { type: "string" }] })).toEqual([
      { pointer: "", message: "must be 1" },
    ])
  })
})
