/**
 * Generates the vocabularies of `@kirana-style/states`, each from what its library publishes about
 * its parts' states, and named by the library's own exports:
 *
 *   bun run gen:states
 *
 * - `src/base-ui.ts` from `@base-ui/react` (MIT, Copyright (c) 2019 Material-UI SAS). Base UI
 *   documents each part's states as modules of `export declare const <state> = "data-<attribute>"`,
 *   with a description and, for a state that takes values, an `@type` union. A component's
 *   `index.d.ts` re-exports each module as `<Part>DataAttributes` (`SelectPopupDataAttributes`), and
 *   its `index.parts.d.ts` gives the part's public name (`SelectPopup as Popup`). A part that reuses
 *   another component's (`AlertDialog.Popup` is `DialogPopup`) is re-exported under its own name.
 * - `src/ark-ui.ts` from `@zag-js/docs` (MIT, Copyright (c) 2021 Chakra UI), the data-attribute
 *   reference of the Zag machines Ark UI is built on, at the Zag version Ark UI depends on. Kept to
 *   the components and parts `@ark-ui/react` exports; Ark UI for Vue, Solid and Svelte name them
 *   alike.
 * - `src/react-aria.ts` from `react-aria-components` (Apache-2.0, Copyright 2019 Adobe; the
 *   licence ships in the package's `licenses/`). Each component's `<Name>RenderProps` interface
 *   documents a state with `@selector`, inherited through `extends`, `Omit<>` and `Pick<>`. Kept to
 *   the components the package exports.
 *
 * Each state becomes a condition key: an attribute's presence (`checked: "[data-checked]"`), or,
 * for a union of string literals, one key per value (`side.inlineEnd: '[data-side="inline-end"]'`).
 * The descriptions are the libraries' own.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)

type State = {
  name: string
  /** The attribute, for a state its selector reads by presence or value. */
  attribute: string
  doc: string
  values: string[]
  /** A selector that is not an attribute's presence (`:not([aria-valuenow])`). */
  selector?: string
}
/** Components, each with its parts' states, or its own states when it has no parts. */
type Vocabulary = Map<string, Map<string, State[]> | State[]>

/** A package's directory and version. */
function installed(name: string, entry = "package.json") {
  const file = require.resolve(`${name}/${entry}`)
  let directory = path.dirname(file)
  while (!existsSync(path.join(directory, "package.json")))
    directory = path.dirname(directory)
  const version = JSON.parse(
    readFileSync(path.join(directory, "package.json"), "utf8")
  ).version as string
  return { directory, version }
}

/** `inline-end` → `inlineEnd`. */
const camel = (value: string) =>
  value.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())

/** `radio-group` → `RadioGroup`. */
const pascal = (value: string) =>
  camel(value).replace(/^\w/, (letter) => letter.toUpperCase())

/** Comment lines without their `*`, for a JSDoc block's text. */
const commentLines = (block: string) =>
  block
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)

const sorted = (vocabulary: Vocabulary): Vocabulary =>
  new Map([...vocabulary].sort(([a], [b]) => a.localeCompare(b)))

// Base UI ---------------------------------------------------------------------------------------

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
function baseUiStates(file: string, seen = new Set<string>()): State[] {
  if (seen.has(file)) return []
  seen.add(file)
  const text = readFileSync(file, "utf8")
  const out: State[] = []
  for (const match of text.matchAll(
    /(?:\/\*\*([\s\S]*?)\*\/\s*)?export declare const (\w+) = "(data-[\w-]+)";/g
  )) {
    const comment = commentLines(match[1] ?? "")
    out.push({
      name: match[2]!,
      attribute: match[3]!,
      doc: comment.filter((line) => !line.startsWith("@")).join(" "),
      values: literals(comment.find((line) => line.startsWith("@type"))),
    })
  }
  for (const match of text.matchAll(/export \* from "([^"]+)";/g))
    out.push(...baseUiStates(declaration(file, match[1]!), seen))
  return out
}

function baseUi(): { vocabulary: Vocabulary; version: string } {
  const { directory: root, version } = installed("@base-ui/react")
  const out: Vocabulary = new Map()
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
      for (const [name, module] of modules) out.set(name, baseUiStates(module))
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
      if (module) byPart.set(exported!, baseUiStates(module))
    }
    if (byPart.size > 0) out.set(namespace[1]!, byPart)
  }
  return { vocabulary: sorted(out), version }
}

// Ark UI (Zag) ----------------------------------------------------------------------------------

/**
 * A state from Zag's reference: a description ("Present when hovered") is a presence, a union of
 * quoted strings (`"open" | "closed"`) one key per value. Read by splitting, never by a pattern.
 */
function zagState(attribute: string, described: string): State {
  const name = camel(attribute.replace(/^data-/, ""))
  const members = described.split("|").map((member) => member.trim())
  const quoted = (member: string) =>
    member.length > 2 &&
    member.startsWith('"') &&
    member.endsWith('"') &&
    !member.slice(1, -1).includes('"')
  if (members.length > 0 && members.every(quoted))
    return {
      name,
      attribute,
      doc: "",
      values: members.map((member) => member.slice(1, -1)),
    }
  return { name, attribute, doc: described, values: [] }
}

async function arkUi(): Promise<{ vocabulary: Vocabulary; version: string }> {
  const { directory, version } = installed("@zag-js/docs")
  const reference = JSON.parse(
    readFileSync(path.join(directory, "data/data-attr.json"), "utf8")
  ) as Record<string, Record<string, Record<string, string>>>
  const ark = (await import("@ark-ui/react")) as unknown as Record<
    string,
    Record<string, unknown> | undefined
  >
  const out: Vocabulary = new Map()
  for (const [component, parts] of Object.entries(reference)) {
    const name = pascal(component)
    const exported = ark[name]
    if (!exported || typeof exported !== "object") continue
    const byPart = new Map<string, State[]>()
    for (const [part, attributes] of Object.entries(parts)) {
      if (!(part in exported)) continue
      byPart.set(
        part,
        Object.entries(attributes)
          // `data-scope` and `data-part` name the part on every element of it: not states.
          .filter(
            ([attribute]) =>
              attribute !== "data-scope" && attribute !== "data-part"
          )
          .map(([attribute, described]) => zagState(attribute, described))
      )
    }
    if (byPart.size > 0) out.set(name, byPart)
  }
  return { vocabulary: sorted(out), version }
}

// React Aria ------------------------------------------------------------------------------------

type RenderProps = {
  bases: { name: string; omit: string[]; pick?: string[] }[]
  props: { name: string; doc: string; selector?: string }[]
}

/** `A, Omit<B, 'x' | 'y'>, Pick<C, 'z'>`: the interfaces an interface extends, at the top level. */
function bases(clause: string): RenderProps["bases"] {
  const out: RenderProps["bases"] = []
  let depth = 0
  let start = 0
  const parts: string[] = []
  for (let index = 0; index <= clause.length; index++) {
    const character = clause[index]
    if (character === "<") depth++
    else if (character === ">") depth--
    else if ((character === "," && depth === 0) || index === clause.length) {
      parts.push(clause.slice(start, index).trim())
      start = index + 1
    }
  }
  const keys = (text: string) =>
    text
      .split("|")
      .map((key) => key.trim().replace(/^'|'$/g, ""))
      .filter(Boolean)
  for (const part of parts) {
    const helper = /^(Omit|Pick)<(\w+),(.*)>$/s.exec(part)
    if (helper)
      out.push(
        helper[1] === "Omit"
          ? { name: helper[2]!, omit: keys(helper[3]!) }
          : { name: helper[2]!, omit: [], pick: keys(helper[3]!) }
      )
    else if (/^\w+(<.*>)?$/s.test(part))
      out.push({ name: part.replace(/<.*>$/s, ""), omit: [] })
  }
  return out
}

/** Every `<Name>RenderProps` interface in the package's declarations. */
function renderProps(directory: string): Map<string, RenderProps> {
  const out = new Map<string, RenderProps>()
  const source = path.join(directory, "dist/types/src")
  for (const file of readdirSync(source).filter((name) =>
    name.endsWith(".d.ts")
  )) {
    const text = readFileSync(path.join(source, file), "utf8")
    for (const match of text.matchAll(
      /^export interface (\w+RenderProps)(?:<[^>\n]*>)?(?: extends ([^{\n]+))? \{\n([\s\S]*?)^\}/gm
    )) {
      const props: RenderProps["props"] = []
      for (const prop of match[3]!.matchAll(
        /\/\*\*([\s\S]*?)\*\/\s*(?:readonly )?(\w+)\??:/g
      )) {
        const lines = commentLines(prop[1]!)
        const selector = lines
          .find((line) => line.startsWith("@selector "))
          ?.slice("@selector ".length)
          .trim()
        props.push({
          name: prop[2]!,
          doc: lines
            .filter((line) => !line.startsWith("@"))
            .join(" ")
            .trim(),
          selector,
        })
      }
      out.set(match[1]!, { bases: bases(match[2] ?? ""), props })
    }
  }
  return out
}

/** An interface's props, its bases' first, minus what `Omit` drops and outside what `Pick` keeps. */
function resolve(
  name: string,
  all: Map<string, RenderProps>,
  seen = new Set<string>()
): RenderProps["props"] {
  const own = all.get(name)
  if (!own || seen.has(name)) return []
  seen.add(name)
  const inherited = own.bases.flatMap((base) =>
    resolve(base.name, all, seen).filter(
      (prop) =>
        !base.omit.includes(prop.name) &&
        (!base.pick || base.pick.includes(prop.name))
    )
  )
  const names = new Set(own.props.map((prop) => prop.name))
  return [...inherited.filter((prop) => !names.has(prop.name)), ...own.props]
}

/**
 * A state from a `@selector`: `[data-x]` a presence, `[data-x="a | b"]` one key per value unless
 * the values are open-ended (`...`, `number`), and any other selector kept as written. Named for
 * the prop, without `is` (`isFocusVisible` → `focusVisible`).
 */
function ariaState(prop: string, doc: string, selector: string): State {
  const name = prop
    .replace(/^is(?=[A-Z])/, "")
    .replace(/^\w/, (letter) => letter.toLowerCase())
  const presence = /^\[([\w-]+)\]$/.exec(selector)
  if (presence) return { name, attribute: presence[1]!, doc, values: [] }
  const valued = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector)
  if (valued) {
    const values = valued[2]!.split("|").map((value) => value.trim())
    if (
      values.every((value) => /^[a-z][\w-]*$/.test(value) && value !== "number")
    )
      return { name, attribute: valued[1]!, doc, values }
    return { name, attribute: valued[1]!, doc, values: [] }
  }
  return { name, attribute: "", doc, values: [], selector }
}

function reactAria(): { vocabulary: Vocabulary; version: string } {
  const { directory, version } = installed("react-aria-components")
  const index = readFileSync(
    path.join(directory, "dist/types/exports/index.d.ts"),
    "utf8"
  )
  const exported = new Set(
    [...index.matchAll(/export \{([^}]*)\} from/g)].flatMap((match) =>
      match[1]!.split(",").map((name) =>
        name
          .trim()
          .split(/\s+as\s+/)
          .pop()!
      )
    )
  )
  const all = renderProps(directory)
  const out: Vocabulary = new Map()
  for (const interfaceName of all.keys()) {
    const name = interfaceName.replace(/RenderProps$/, "")
    if (!exported.has(name)) continue
    const states = resolve(interfaceName, all)
      .filter((prop) => prop.selector)
      .map((prop) => ariaState(prop.name, prop.doc, prop.selector!))
    if (states.length > 0) out.set(name, states)
  }
  return { vocabulary: sorted(out), version }
}

// Shared by the libraries read from their code ---------------------------------------------------

/**
 * The values a state takes, from the expression that sets it: the string literals it returns
 * (`open ? 'open' : 'closed'`, `return "checked"`), never an empty one (an attribute's presence).
 */
function valuesIn(expression: string): string[] {
  const found = [
    ...expression.matchAll(
      /(?:\?|:|return|=>|\|\||\?\?)\s*(["'`])([a-z0-9][a-z0-9-]*)\1/g
    ),
  ].map((match) => match[2]!)
  return [...new Set(found)]
}

/** Adds a state to a part's list, merging the values of one attribute set in several places. */
function addState(list: State[], attribute: string, values: readonly string[]) {
  const existing = list.find((state) => state.attribute === attribute)
  if (existing) {
    for (const value of values)
      if (!existing.values.includes(value)) existing.values.push(value)
    return
  }
  list.push({
    name: camel(attribute.replace(/^data-/, "")),
    attribute,
    doc: "",
    values: [...values],
  })
}

/**
 * A part's name within its component, at a word boundary: `PopoverTrigger` is `Trigger`, `Popover`
 * itself `Root`, and `Tabset` no part of `Tabs`.
 */
function partName(name: string, component: string): string | undefined {
  if (name === component) return "Root"
  const rest = name.slice(component.length)
  return name.startsWith(component) && /^[A-Z]/.test(rest) ? rest : undefined
}

const byName = (list: State[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name))

// Reka UI ---------------------------------------------------------------------------------------

/** A component file's template, and the script beside it. */
function vueParts(file: string) {
  const text = readFileSync(file, "utf8")
  const template = /<template>([\s\S]*)<\/template>\s*$/.exec(text)?.[1] ?? ""
  const script = text.slice(0, text.indexOf("<template>"))
  return { template, script }
}

/**
 * The body of a helper an attribute's expression calls or reads (`getState(…)`, `dataState`), from
 * the component's script or a module beside it, for the values it returns.
 */
function helperBody(name: string, script: string, directory: string): string {
  const pattern = new RegExp(
    `(?:function\\s+${name}\\b|(?:const|let)\\s+${name}\\s*=)[\\s\\S]*?(?:\\n\\s*\\n|$)`
  )
  const local = pattern.exec(script)?.[0]
  if (local) return local
  for (const file of readdirSync(directory).filter((entry) =>
    entry.endsWith(".ts")
  )) {
    const found = pattern.exec(
      readFileSync(path.join(directory, file), "utf8")
    )?.[0]
    if (found) return found
  }
  return ""
}

/**
 * A template without its HTML comments, removed until none is left: one removal can join the halves
 * of another into a comment (`<!<!---->--`).
 */
function withoutComments(template: string): string {
  let previous: string
  let text = template
  do {
    previous = text
    text = text.replace(/<!--[\s\S]*?-->/g, "")
  } while (text !== previous)
  return text
}

/**
 * The `data-*` attributes a Reka UI component's template sets, and those of the library's own
 * components it renders the element through: the root (`Presence`), or one an attribute is set on
 * (`<PopperContent :data-state>`, which sets `side` and `align` on the same element).
 */
function rekaAttributes(
  file: string,
  source: string,
  depth = 0
): [string, string[]][] {
  const { template, script } = vueParts(file)
  const directory = path.dirname(file)
  const out: [string, string[]][] = []
  const tags = [
    ...withoutComments(template).matchAll(
      /<([A-Za-z][\w-]*)((?:\s+[^\s=>"'/]+(?:=(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g
    ),
  ]
  for (const [index, [, tag, attributes]] of tags.entries()) {
    let carries = index === 0
    for (const match of attributes!.matchAll(
      /(?:^|\s)(:|v-bind:)?(data-[a-z][a-z0-9-]*)(?:=(?:"([^"]*)"|'([^']*)'))?/g
    )) {
      const [, bound, attribute, double, single] = match
      if (attribute!.startsWith("data-reka-")) continue
      carries = true
      const value = double ?? single ?? ""
      if (!bound) {
        out.push([attribute!, value ? [value] : []])
        continue
      }
      let values = valuesIn(value)
      const reference = /^\s*([A-Za-z_$][\w$]*)\s*(?:\(|$|\.value\s*$)/.exec(
        value
      )?.[1]
      if (values.length === 0 && reference)
        values = valuesIn(helperBody(reference, script, directory))
      out.push([attribute!, values])
    }
    if (!carries || !/^[A-Z]/.test(tag!) || depth >= 3) continue
    const imported = new RegExp(
      `import\\s+(?:${tag}|\\{[^}]*\\b${tag}\\b[^}]*\\})\\s+from\\s+["']([^"']+)["']`
    ).exec(script)?.[1]
    if (!imported) continue
    const target = imported.startsWith("@/")
      ? path.join(source, imported.slice(2))
      : path.join(directory, imported)
    // A folder's index names the file: `export { default as PopperContent } from './PopperContent.vue'`.
    const folderIndex = path.join(target, "index.ts")
    const named =
      existsSync(folderIndex) &&
      new RegExp(
        `default as ${tag}\\b[^}]*\\}\\s*from\\s*["']\\./(\\w+)\\.vue["']`
      ).exec(readFileSync(folderIndex, "utf8"))?.[1]
    const candidate = named
      ? path.join(target, `${named}.vue`)
      : target.endsWith(".vue")
        ? target
        : `${target}.vue`
    if (existsSync(candidate))
      out.push(...rekaAttributes(candidate, source, depth + 1))
  }
  return out
}

function rekaUi(): { vocabulary: Vocabulary; version: string } {
  const { directory, version } = installed("reka-ui")
  const source = path.join(directory, "src")
  const out: Vocabulary = new Map()
  for (const component of readdirSync(source).sort()) {
    const folder = path.join(source, component)
    const index = path.join(folder, "index.ts")
    if (!existsSync(index)) continue
    const exported = [
      ...readFileSync(index, "utf8").matchAll(
        /default as (\w+)[^}]*\}\s*from\s*["']\.\/(\w+)\.vue["']/g
      ),
    ].map(([, name, file]) => ({ name: name!, file: file! }))
    const files = readdirSync(folder).filter((entry) => entry.endsWith(".vue"))
    const byPart = new Map<string, State[]>()
    for (const { name, file } of exported) {
      const part = partName(name, component)
      if (!part) continue
      const list: State[] = []
      // A part's internal variants (`PopoverContentImpl`, `…Modal`) render its element too.
      const own = files.filter(
        (entry) =>
          entry === `${file}.vue` ||
          (entry.startsWith(file) &&
            !exported.some((other) => `${other.file}.vue` === entry))
      )
      for (const entry of own)
        for (const [attribute, values] of rekaAttributes(
          path.join(folder, entry),
          source
        ))
          addState(list, attribute, values)
      if (list.length) byPart.set(part, byName(list))
    }
    if (byPart.size) out.set(component, byPart)
  }
  return { vocabulary: sorted(out), version }
}

// Bits UI ---------------------------------------------------------------------------------------

/** The `data-*` entries of a Bits UI state class's `props`: `"data-state": "open" | "closed"`. */
function bitsProps(module: string, className: string): [string, string[]][] {
  const text = readFileSync(module, "utf8")
  const start = text.indexOf(`export declare class ${className} {`)
  if (start < 0) return []
  const body = text.slice(start, text.indexOf("\n}\n", start))
  const props = /readonly props: \{([\s\S]*?)\n {4}\};/.exec(body)?.[1] ?? ""
  return [
    ...props.matchAll(/readonly "(data-[a-z][a-z0-9-]*)"\??: ([^;]+);/g),
  ].map(([, attribute, type]) => [
    attribute!,
    [...type!.matchAll(/"([a-z0-9][a-z0-9-]*)"/g)].map((match) => match[1]!),
  ])
}

function bitsUi(): { vocabulary: Vocabulary; version: string } {
  const { directory, version } = installed("bits-ui")
  const bits = path.join(directory, "dist/bits")
  const out: Vocabulary = new Map()
  const components = [
    ...readFileSync(path.join(bits, "index.d.ts"), "utf8").matchAll(
      /export \{ (\w+) \} from "\.\/([\w-]+)\/index\.js"/g
    ),
  ]
  for (const [, component, folder] of components) {
    const exports = path.join(bits, folder!, "exports.d.ts")
    if (!existsSync(exports)) continue
    const byPart = new Map<string, State[]>()
    for (const [, part, from] of readFileSync(exports, "utf8").matchAll(
      /export \{ default as (\w+) \} from "([^"]+)\.svelte"/g
    )) {
      const file = path.join(bits, folder!, `${from}.svelte`)
      if (!existsSync(file)) continue
      const text = readFileSync(file, "utf8")
      const list: State[] = []
      for (const [, className] of text.matchAll(/(\w+State)\.create\(/g)) {
        const module = new RegExp(
          `import \\{[^}]*\\b${className}\\b[^}]*\\} from "([^"]+)\\.js"`
        ).exec(text)?.[1]
        if (!module) continue
        for (const [attribute, values] of bitsProps(
          path.join(path.dirname(file), `${module}.d.ts`),
          className!
        )) {
          // `data-popover-trigger`, `data-menu-item`: the part's name on its element, not a state.
          const own = attribute.replace(/^data-/, "")
          const names = [
            folder!,
            path.basename(path.dirname(path.dirname(file))),
          ]
          if (
            values.length === 0 &&
            names.some((name) => own.startsWith(`${name}-`))
          )
            continue
          addState(list, attribute, values)
        }
      }
      if (list.length) byPart.set(part!, byName(list))
    }
    if (byPart.size) out.set(component!, byPart)
  }
  return { vocabulary: sorted(out), version }
}

// Angular Primitives ----------------------------------------------------------------------------

/** What `ngpInteractions({ … })` turns on, by the attribute each sets. */
const INTERACTIONS: Readonly<Record<string, string>> = {
  hover: "data-hover",
  press: "data-press",
  focus: "data-focus",
  focusVisible: "data-focus-visible",
}

/** Entry points that hold the library's machinery rather than components. */
const NG_MACHINERY = new Set([
  "state",
  "internal",
  "utils",
  "interactions",
  "a11y",
  "common",
  "portal",
])

function ngPrimitives(): { vocabulary: Vocabulary; version: string } {
  const { directory, version } = installed("ng-primitives")
  const modules = path.join(directory, "fesm2022")
  const out: Vocabulary = new Map()
  for (const file of readdirSync(modules).filter((entry) =>
    /^ng-primitives-[\w-]+\.mjs$/.test(entry)
  )) {
    const entry = file.slice("ng-primitives-".length, -".mjs".length)
    if (NG_MACHINERY.has(entry)) continue
    const component = pascal(entry)
    const text = readFileSync(path.join(modules, file), "utf8")
    const blocks = text.split(/(?=createPrimitive\('Ngp)/).slice(1)
    const byPart = new Map<string, State[]>()
    for (const block of blocks) {
      const name = /^createPrimitive\('Ngp(\w+)'/.exec(block)![1]!
      // The block's own directive: a primitive another one only uses has no class of its own.
      if (!text.includes(`class Ngp${name} {`)) continue
      const part = partName(name, component) ?? name
      const list: State[] = []
      for (const [, attribute, expression] of block.matchAll(
        /dataBinding\(\w+, '(data-[a-z][a-z0-9-]*)', ([^\n]*)\);/g
      ))
        addState(list, attribute!, valuesIn(expression!))
      const interactions =
        /ngpInteractions\(\{([^}]*)\}\)/.exec(block)?.[1] ?? ""
      for (const [key, attribute] of Object.entries(INTERACTIONS))
        if (new RegExp(`\\b${key}\\s*:\\s*(?!false)`).test(interactions))
          addState(list, attribute, [])
      if (list.length) byPart.set(part, byName(list))
    }
    if (byPart.size) out.set(component, byPart)
  }
  return { vocabulary: sorted(out), version }
}

// Writing ---------------------------------------------------------------------------------------

/**
 * States a library sets one at a time, as `conditions.exclusive` groups: the descriptions say so
 * ("is checked" and "is not checked", "begins animating in" and "is animating out"). A pair is
 * exported only where one part has both as presences; two values of one attribute need no group.
 */
const OPPOSITES: readonly (readonly [string, string])[] = [
  ["checked", "unchecked"],
  ["open", "closed"],
  ["startingStyle", "endingStyle"],
  ["valid", "invalid"],
]

const selectorOf = (state: State) => state.selector ?? `[${state.attribute}]`

function exclusiveGroups(vocabulary: Vocabulary): string[][] {
  const groups = new Map<string, string[]>()
  for (const value of vocabulary.values())
    for (const list of Array.isArray(value) ? [value] : value.values())
      for (const [a, b] of OPPOSITES) {
        const left = list.find((state) => state.name === a)
        const right = list.find((state) => state.name === b)
        if (left && right && !left.values.length && !right.values.length) {
          const group = [selectorOf(left), selectorOf(right)]
          groups.set(group.join(" "), group)
        }
      }
  return [...groups.values()]
}

const quote = (selector: string) =>
  selector.includes('"') ? `'${selector}'` : `"${selector}"`

function stateLines(list: State[], indent: string): string[] {
  const lines: string[] = []
  for (const state of list) {
    if (state.doc)
      lines.push(`${indent}/** ${state.doc.replaceAll("*/", "*\\/")} */`)
    if (state.values.length === 0) {
      lines.push(`${indent}${state.name}: ${quote(selectorOf(state))},`)
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

function write(
  file: string,
  library: string,
  header: readonly string[],
  vocabulary: Vocabulary
) {
  const lines = [
    ...header,
    "",
    "/**",
    ` * States ${library} sets one at a time on a part, for \`conditions.exclusive\` in`,
    " * `kirana.config`, so writing both on one property is not `ambiguous-precedence`:",
    " *",
    ` *   import { exclusive } from "@kirana-style/states/${path.basename(file, ".ts")}"`,
    " *   export default defineConfig({ conditions: { exclusive } })",
    " */",
    `export const exclusive: string[][] = ${JSON.stringify(exclusiveGroups(vocabulary))}`,
    "",
  ]
  for (const [name, value] of vocabulary) {
    lines.push(`export const ${name} = {`)
    if (Array.isArray(value)) lines.push(...stateLines(value, "  "))
    else
      for (const [part, list] of value)
        lines.push(`  ${part}: {`, ...stateLines(list, "    "), "  },")
    lines.push("} as const", "")
  }
  const output = path.join(import.meta.dirname, "../npm/states/src", file)
  writeFileSync(output, lines.join("\n"))
  return output
}

const base = baseUi()
const ark = await arkUi()
const aria = reactAria()
const reka = rekaUi()
const bitsVocabulary = bitsUi()
const ng = ngPrimitives()
const outputs = [
  write(
    "base-ui.ts",
    "Base UI",
    [
      `// @generated by scripts/gen-states.ts from @base-ui/react ${base.version} (MIT, Copyright (c) 2019`,
      "// Material-UI SAS): the descriptions are Base UI's. Do not edit.",
    ],
    base.vocabulary
  ),
  write(
    "ark-ui.ts",
    "Ark UI",
    [
      `// @generated by scripts/gen-states.ts from @zag-js/docs ${ark.version}, the machines Ark UI is`,
      "// built on (MIT, Copyright (c) 2021 Chakra UI): the descriptions are Zag's. Do not edit.",
    ],
    ark.vocabulary
  ),
  write(
    "react-aria.ts",
    "React Aria",
    [
      `// @generated by scripts/gen-states.ts from react-aria-components ${aria.version} (Apache-2.0,`,
      "// Copyright 2019 Adobe; licenses/react-aria-components.txt): the descriptions are React",
      "// Aria's. Do not edit.",
    ],
    aria.vocabulary
  ),
  write(
    "reka-ui.ts",
    "Reka UI",
    [
      `// @generated by scripts/gen-states.ts from reka-ui ${reka.version} (MIT, Copyright (c) 2023 UnoVue):`,
      "// each part's data attributes, read from its template. Do not edit.",
    ],
    reka.vocabulary
  ),
  write(
    "bits-ui.ts",
    "Bits UI",
    [
      `// @generated by scripts/gen-states.ts from bits-ui ${bitsVocabulary.version} (MIT, Copyright (c) 2023`,
      "// Hunter Johnston): each part's data attributes, read from its state's props. Do not edit.",
    ],
    bitsVocabulary.vocabulary
  ),
  write(
    "ng-primitives.ts",
    "Angular Primitives",
    [
      `// @generated by scripts/gen-states.ts from ng-primitives ${ng.version} (Apache-2.0): each part's`,
      "// data attributes, read from its bindings. Do not edit.",
    ],
    ng.vocabulary
  ),
]
// Formatted with the repository's formatter so the CI freshness check compares like with like.
const format = spawnSync("bunx", ["vp", "fmt", ...outputs], {
  cwd: path.join(import.meta.dirname, "../../.."),
  stdio: "inherit",
})
if (format.status !== 0) throw new Error("vp fmt failed")
