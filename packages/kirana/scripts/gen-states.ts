/**
 * Generates `npm/states/src/base-ui.ts` from the declarations `@base-ui/react` publishes
 * (MIT, Copyright (c) 2019 Material-UI SAS; the notice ships in the package README).
 *
 *   bun run gen:states
 *
 * Base UI documents each part's states as modules of `export declare const <state> =
 * "data-<attribute>"`, with a description and, for a state that takes values, an `@type` union.
 * The names come from Base UI's own exports, never from directory names: a component's
 * `index.d.ts` re-exports each module as `<Part>DataAttributes` (`SelectPopupDataAttributes`), and
 * its `index.parts.d.ts` gives the part's public name (`SelectPopup as Popup`). A part that reuses
 * another component's (`AlertDialog.Popup` is `DialogPopup`, `Select.Separator` reads
 * `SeparatorDataAttributes`) is re-exported under its own name, so it gets those states too.
 *
 * Each state becomes a condition key: an attribute's presence (`checked: "[data-checked]"`), or,
 * for a union of string literals, one key per value (`side.inlineEnd: '[data-side="inline-end"]'`).
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const root = path.dirname(require.resolve("@base-ui/react/package.json"))
const version = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8")
).version

type State = { name: string; attribute: string; doc: string; values: string[] }

/** `.js` in a declaration's specifier names the `.d.ts` beside it. */
const declaration = (from: string, specifier: string) =>
  path.resolve(path.dirname(from), specifier.replace(/\.js$/, ".d.ts"))

/**
 * The values of an `@type {'a' | 'b' | null}` union of string literals, `null` left out; none for
 * any other type (`{boolean}`, `{number}`, a template literal). Read by splitting, not by a pattern,
 * so no input can make it backtrack.
 */
function literals(type: string | undefined): string[] {
  const body = type?.slice("@type".length).trim() ?? ""
  if (!body.startsWith("{") || !body.endsWith("}")) return []
  const members = body
    .slice(1, -1)
    .split("|")
    .map((member) => member.trim())
  const literal = (member: string) =>
    member.length > 2 &&
    member.startsWith("'") &&
    member.endsWith("'") &&
    !member.slice(1, -1).includes("'")
  if (!members.every((member) => member === "null" || literal(member)))
    return []
  return members.filter(literal).map((member) => member.slice(1, -1))
}

/** A module's states, in declaration order, with the states it re-exports after them. */
function states(file: string, seen = new Set<string>()): State[] {
  if (seen.has(file)) return []
  seen.add(file)
  const text = readFileSync(file, "utf8")
  const out: State[] = []
  for (const match of text.matchAll(
    /(?:\/\*\*([\s\S]*?)\*\/\s*)?export declare const (\w+) = "(data-[\w-]+)";/g
  )) {
    const comment = (match[1] ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
    out.push({
      name: match[2]!,
      attribute: match[3]!,
      doc: comment.filter((line) => !line.startsWith("@")).join(" "),
      values: literals(comment.find((line) => line.startsWith("@type"))),
    })
  }
  for (const match of text.matchAll(/export \* from "([^"]+)";/g))
    out.push(...states(declaration(file, match[1]!), seen))
  return out
}

/** `inline-end` → `inlineEnd`. */
const camel = (value: string) =>
  value.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())

/** Each component's parts and their states, as Base UI exports them. */
function components(): Map<string, Map<string, State[]> | State[]> {
  const out = new Map<string, Map<string, State[]> | State[]>()
  const index = readFileSync(path.join(root, "index.d.ts"), "utf8")
  for (const [, directory] of index.matchAll(
    /export \* from "\.\/([\w-]+)\/index\.js";/g
  )) {
    const file = path.join(root, directory!, "index.d.ts")
    if (!existsSync(file)) continue
    const text = readFileSync(file, "utf8")
    const modules = new Map(
      [
        ...text.matchAll(/export \* as (\w+)DataAttributes from "([^"]+)";/g),
      ].map((match) => [match[1]!, declaration(file, match[2]!)])
    )
    if (modules.size === 0) continue
    const namespace = /export \* as (\w+) from "\.\/index\.parts\.js";/.exec(
      text
    )
    if (!namespace) {
      // A component without parts (`Button`, `Toggle`): its own module, under its own name.
      for (const [name, module] of modules) out.set(name, states(module))
      continue
    }
    const parts = readFileSync(
      path.join(root, directory!, "index.parts.d.ts"),
      "utf8"
    )
    const byPart = new Map<string, State[]>()
    for (const [, local, exported] of parts.matchAll(
      /export \{ (\w+) as (\w+) \}/g
    )) {
      // Named for the public part (`AlertDialogPopupDataAttributes` for `DialogPopup as Popup`).
      const module =
        modules.get(`${namespace[1]}${exported}`) ?? modules.get(local!)
      if (module) byPart.set(exported!, states(module))
    }
    if (byPart.size > 0) out.set(namespace[1]!, byPart)
  }
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)))
}

const quote = (selector: string) =>
  selector.includes('"') ? `'${selector}'` : `"${selector}"`

function stateLines(list: State[], indent: string): string[] {
  const lines: string[] = []
  for (const state of list) {
    if (state.doc)
      lines.push(`${indent}/** ${state.doc.replaceAll("*/", "*\\/")} */`)
    if (state.values.length === 0) {
      lines.push(`${indent}${state.name}: ${quote(`[${state.attribute}]`)},`)
      continue
    }
    lines.push(`${indent}${state.name}: {`)
    for (const value of state.values) {
      const key = /^[A-Za-z_]\w*$/.test(camel(value))
        ? camel(value)
        : JSON.stringify(value)
      lines.push(
        `${indent}  ${key}: ${quote(`[${state.attribute}="${value}"]`)},`
      )
    }
    lines.push(`${indent}},`)
  }
  return lines
}

const lines = [
  `// @generated by scripts/gen-states.ts from @base-ui/react ${version} (MIT, Copyright (c) 2019`,
  "// Material-UI SAS): the descriptions are Base UI's. Do not edit.",
  "",
]
for (const [name, value] of components()) {
  lines.push(`export const ${name} = {`)
  if (Array.isArray(value)) lines.push(...stateLines(value, "  "))
  else
    for (const [part, list] of value) {
      lines.push(`  ${part}: {`, ...stateLines(list, "    "), "  },")
    }
  lines.push("} as const", "")
}

const output = path.join(import.meta.dirname, "../npm/states/src/base-ui.ts")
writeFileSync(output, lines.join("\n"))
// Formatted with the repository's formatter so the CI freshness check compares like with like.
const format = spawnSync("bunx", ["vp", "fmt", output], {
  cwd: path.join(import.meta.dirname, "../../.."),
  stdio: "inherit",
})
if (format.status !== 0) throw new Error("vp fmt failed")
