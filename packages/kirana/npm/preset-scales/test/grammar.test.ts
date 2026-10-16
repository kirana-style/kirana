/**
 * The M5 exit criterion: utility and object forms of the same styles produce identical atoms
 * (`design-notes/utility-surface.md`). Generated from the grammar itself — every root with every key of
 * its scale or keyword table, every variant, and the negative, alpha and fraction forms — so a utility
 * added to the grammar is tested by adding it.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Driver } from "@kirana-style/compiler"
import type { UtilityRule } from "@kirana-style/core/config"
import { afterAll, describe, expect, it } from "vite-plus/test"

import * as scales from "../src/index.ts"
import scalesPreset, { grammar } from "../src/preset.ts"

const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
writeFileSync(path.join(root, "package.json"), '{"name":"app","type":"module"}')
afterAll(() => rmSync(root, { recursive: true, force: true }))
const driver = await Driver.create({
  root,
  config: { presets: [scalesPreset()] },
})

type Case = { utility: string; object: string }

/** The preset's exports by name, for the scales the grammar names. */
const tokens: Record<string, unknown> = { ...scales }

/** Every key of a scale export, `blue-600` for nested groups, with the expression reaching it. */
function keys(value: unknown, prefix: string[] = []): [string[], string][] {
  if (typeof value === "string") return [[prefix, prefix.join("-")]]
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, inner]) => keys(inner, [...prefix, key])
  )
}
const access = (exported: string, keyPath: string[]) =>
  `${exported}${keyPath.map((part) => `[${JSON.stringify(part)}]`).join("")}`
/** A `{scale.key}` reference as the expression reaching that token. */
const reference = (text: string) => {
  const [scale, key] = text.split(".") as [string, string]
  return access(grammar.scales![scale]![0]!.export, [key])
}
/** Grammar text as an expression: a string, one token, or a template with its token references. */
const js = (text: string): string =>
  /^\{[^}]+\}$/.test(text)
    ? reference(text.slice(1, -1))
    : text.includes("{")
      ? "`" +
        text.replace(
          /\{([^}]+)\}/g,
          (_, inner: string) => "${" + reference(inner) + "}"
        ) +
        "`"
      : JSON.stringify(text)
/** A property as a key: a token when written `{scale.key}`. */
const asKey = (property: string) =>
  property.startsWith("{")
    ? `[${reference(property.slice(1, -1))}]`
    : JSON.stringify(property)
const declarations = (entries: [string, string][]) =>
  `{ ${entries.map(([property, value]) => `${asKey(property)}: ${value}`).join(", ")} }`
/** A rule's value placed in its `format`, if it has one. */
const formatted = (rule: { format?: string }, value: string) =>
  rule.format
    ? "`" +
      rule.format.replace(/\{([^}]+)\}/g, (_, inner: string) =>
        inner === "value" ? "${" + value + "}" : "${" + reference(inner) + "}"
      ) +
      "`"
    : value
const also = (rule: { also?: Record<string, string> }) =>
  Object.entries(rule.also ?? {}).map(([property, text]): [string, string] => [
    property,
    js(text),
  ])

function cases(): Case[] {
  const all: Case[] = []
  for (const [name, rules] of Object.entries(grammar.utilities!)) {
    for (const rule of rules as UtilityRule[]) {
      if ("static" in rule) {
        all.push({
          utility: name,
          object: declarations(
            Object.entries(rule.static).map(([property, value]) => [
              property,
              js(value),
            ])
          ),
        })
      } else if ("values" in rule) {
        for (const [key, value] of Object.entries(rule.values)) {
          all.push({
            utility: `${name}-${key}`,
            object: declarations([
              ...rule.properties.map((property): [string, string] => [
                property,
                js(value),
              ]),
              ...also(rule),
            ]),
          })
        }
      } else {
        // A number that is not a key: `step` times it, then the unit.
        const scaleKeys = rule.scale
          ? keys(tokens[grammar.scales![rule.scale]![0]!.export]).map(
              ([, key]) => key
            )
          : []
        if (rule.number && !scaleKeys.includes("13")) {
          const value = `${Math.round(13 * (rule.number.step ?? 1) * 1e6) / 1e6}${rule.number.unit ?? ""}`
          all.push({
            utility: `${name}-13`,
            object: declarations([
              ...rule.properties.map((property): [string, string] => [
                property,
                formatted(rule, JSON.stringify(value)),
              ]),
              ...also(rule),
            ]),
          })
        }
        if (!rule.scale) continue
        const exported = grammar.scales![rule.scale]![0]!.export
        const aliases = Object.fromEntries(
          Object.entries(rule.aliases ?? {}).map(([alias, key]) => [key, alias])
        )
        for (const [keyPath, key] of keys(tokens[exported])) {
          const pair = Object.entries(rule.pair ?? {}).map(
            ([property, scale]): [string, string] => {
              const other = grammar.scales![scale]![0]!.export
              return [property, access(other, keyPath)]
            }
          )
          all.push({
            utility: `${name}-${aliases[key] ?? key}`,
            object: declarations([
              ...rule.properties.map((property): [string, string] => [
                property,
                formatted(rule, access(exported, keyPath)),
              ]),
              ...pair,
              ...also(rule),
            ]),
          })
        }
      }
    }
  }
  return all
}

function compile(source: string, file: string): string {
  const result = driver.transform(path.join(root, file), source)
  const errors = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error"
  )
  if (errors.length)
    throw new Error(
      `${file}: ${errors.map((error) => error.message).join("; ")}\n${source}`
    )
  const match = /className="([^"]*)"|export const s = "([^"]*)"/.exec(
    result.code ?? ""
  )
  // Atoms only: a handle also carries merge markers (`k5X_`, a tombstone), which the DOM's class
  // list never shows and no CSS rule matches.
  return (match?.[1] ?? match?.[2] ?? "")
    .split(" ")
    .filter((name) => !name.endsWith("_"))
    .sort()
    .join(" ")
}

/**
 * A string as a JavaScript string literal for generated source: JSON's escaping, plus `<`, `>`, `/`
 * and the two line separators as `\u` escapes, so no utility can end the literal or the line it
 * sits on. It goes in an expression (`sx={…}`): a JSX attribute string reads no escapes at all.
 */
const literal = (text: string) =>
  JSON.stringify(text).replace(
    /[<>/\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
  )

let counter = 0
function same(utility: string, object: string) {
  const index = counter++
  const fromUtility = compile(
    `export const A = () => <p sx={${literal(utility)}} />\n`,
    `u${index}.tsx`
  )
  const fromObject = compile(
    `import { css } from "@kirana-style/core"\nimport * as scales from "@kirana-style/preset-scales"\nconst { ${Object.keys(scales).join(", ")} } = scales\nexport const s = css(${object})\n`,
    `o${index}.ts`
  )
  expect(fromUtility, `${utility} ≡ ${object}`).toBe(fromObject)
  expect(fromUtility).not.toBe("")
}

describe("utility and object forms produce identical atoms", () => {
  const generated = cases()

  it(`every root with every key (${generated.length} utilities)`, () => {
    expect(generated.length).toBeGreaterThan(2000)
    for (const { utility, object } of generated) same(utility, object)
    // Thousands of compilations; the coverage build's instrumented engine is several times slower.
  }, 120_000)

  it("every variant", () => {
    for (const [variant, condition] of Object.entries(grammar.variants!)) {
      // A pseudo-element is a block; `before:` and `after:` also get their `content`.
      const content = ["::before", "::after"].includes(condition)
        ? `content: '""', `
        : ""
      same(
        `${variant}:pt-4`,
        condition.startsWith("::")
          ? `{ ${JSON.stringify(condition)}: { ${content}paddingTop: space["4"] } }`
          : `{ paddingTop: { ${JSON.stringify(condition)}: space["4"] } }`
      )
    }
    same(
      "@md/card:pt-4",
      `{ paddingTop: { "@container card (width >= 28rem)": space["4"] } }`
    )
    same(
      "@[250px]:pt-4",
      `{ paddingTop: { "@container (width >= 250px)": space["4"] } }`
    )
    same("nth-3:pt-4", `{ paddingTop: { ":nth-child(3)": space["4"] } }`)
    same(
      "nth-last-[2n]:pt-4",
      `{ paddingTop: { ":nth-last-child(2n)": space["4"] } }`
    )
    same(
      "supports-backdrop-filter:pt-4",
      `{ paddingTop: { "@supports (backdrop-filter: var(--tw))": space["4"] } }`
    )
    same(
      "supports-[display:grid]:pt-4",
      `{ paddingTop: { "@supports (display:grid)": space["4"] } }`
    )
    same(
      "data-side=left:pt-4",
      `{ paddingTop: { '[data-side="left"]': space["4"] } }`
    )
    same("data-open:pt-4", `{ paddingTop: { "[data-open]": space["4"] } }`)
    same(
      "aria-invalid:pt-4",
      `{ paddingTop: { '[aria-invalid="true"]': space["4"] } }`
    )
    same("has-[svg]:pt-4", `{ paddingTop: { ":has(svg)": space["4"] } }`)
    same(
      "has-data-[x]:pt-4",
      `{ paddingTop: { ":has([data-x])": space["4"] } }`
    )
    same(
      "not-first:pt-4",
      `{ paddingTop: { ":not(:first-child)": space["4"] } }`
    )
    same(
      "[&:nth-child(2)]:pt-4",
      `{ paddingTop: { ":nth-child(2)": space["4"] } }`
    )
    same("[a]:pt-4", `{ paddingTop: { ":is(a)": space["4"] } }`)
    // `content` only where the block's declarations apply: no `::after` until hovered.
    same(
      "hover:after:pt-4",
      `{ "::after": { content: { ":hover": '""' }, paddingTop: { ":hover": space["4"] } } }`
    )
    same(
      "after:absolute hover:after:pt-4",
      `{ "::after": { content: '""', position: "absolute", paddingTop: { ":hover": space["4"] } } }`
    )
    same(
      "data-[state=open]:pt-4",
      `{ paddingTop: { '[data-state="open"]': space["4"] } }`
    )
    same(
      "aria-[expanded]:pt-4",
      `{ paddingTop: { "[aria-expanded]": space["4"] } }`
    )
    same(
      "md:hover:pt-4 pt-2",
      `{ paddingTop: { base: space["2"], "@media (width >= 48rem)": { ":hover": space["4"] } } }`
    )
  })

  it("negative, alpha, fraction and bracketed values", () => {
    same("-mt-4", `{ marginTop: "calc(" + space["4"] + " * -1)" }`)
    same(
      "bg-blue-600/50",
      `{ backgroundColor: "color-mix(in oklab, " + color.blue["600"] + " 50%, transparent)" }`
    )
    same("w-1/2", `{ width: "calc(1/2 * 100%)" }`)
    same("p-[3px]", `{ paddingBlock: "3px", paddingInline: "3px" }`)
    same("text-[13px]", `{ fontSize: "13px" }`)
    same("text-[#0af]", `{ color: "#0af" }`)
    same("grid-cols-[1fr_auto]", `{ gridTemplateColumns: "1fr auto" }`)
    same("px-2 px-4", `{ paddingInline: space["4"] }`)
    same("w-(--sidebar)", `{ width: "var(--sidebar)" }`)
    same("bg-(--brand)", `{ backgroundColor: "var(--brand)" }`)
    same(
      "-translate-x-1/2",
      '{ [compose["translate-x"]]: "calc(calc(1/2 * 100%) * -1)", translate: `${compose["translate-x"]} ${compose["translate-y"]}` }'
    )
    same(
      "@container/card",
      `{ containerType: "inline-size", containerName: "card" }`
    )
  })
})

describe("composed utilities emit Tailwind's chains", () => {
  it("a filter lists every step, unset ones falling back to nothing", () => {
    compile(
      `export const A = () => <p sx="grayscale brightness-50 duration-100 animate-in fade-in-0 zoom-in-95" />\n`,
      "chains.tsx"
    )
    const css = driver.stylesheet(false)
    // Nine steps; the two this element sets are declared on it.
    expect(css).toMatch(/filter: (var\(--kv\w+,\) ?){9};/)
    expect(css).toContain("grayscale(100%)")
    expect(css).toContain("brightness(50%)")
    expect(css).toMatch(
      /@property --kv\w+ \{\s+syntax: "\*";\s+inherits: false;\s+\}/
    )
    // `duration-100` times the animation through the same layer `animate-in` reads.
    expect(css).toMatch(/--kv\w+: 100ms;/)
    expect(css).toMatch(/animation-duration: var\(--kv\w+\);/)
    expect(css).toMatch(
      /@keyframes \w+ \{\s+from \{\s+opacity: var\(--kv\w+\);/
    )
  })
})
