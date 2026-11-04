/**
 * Generates the vocabularies of `@kirana-style/states` in `npm/states/src`, each from what its
 * library publishes about its parts' states, and named by the library's own exports:
 *
 *   bun run gen:states
 *
 * - `base-ui.ts` from `@base-ui/react` (MIT, Copyright (c) 2019 Material-UI SAS): each part's
 *   `<Part>DataAttributes` module, plus the `open` states its implementation writes (`openAttributes`).
 * - `ark-ui.ts` from `@zag-js/docs` (MIT, Copyright (c) 2021 Chakra UI), the data-attribute reference
 *   of the Zag machines Ark UI is built on, with what each part's prop getter in the machine's
 *   `connect` sets that the reference leaves out, kept to the parts `@ark-ui/react` exports, and the
 *   getters a part's module merges under another part's name.
 * - `react-aria.ts` from `react-aria-components` (Apache-2.0, Copyright 2019 Adobe; the licence
 *   ships in the package's `licenses/`): the `@selector` of each `<Name>RenderProps` interface.
 * - `reka-ui.ts` (MIT, Copyright (c) 2023 UnoVue), `bits-ui.ts` (MIT, Copyright (c) 2023 Hunter
 *   Johnston) and `ng-primitives.ts` (Apache-2.0), read from each part's code.
 *
 * Each state becomes a condition key: an attribute's presence (`checked: "[data-checked]"`), or,
 * for a union of string literals, one key per value (`side.inlineEnd: '[data-side="inline-end"]'`).
 */
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { parseSync } from "oxc-parser"

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

/**
 * The attributes a Base UI part's `stateAttributesMapping` writes for `open: true` and `open: false`,
 * by evaluating the mappings its implementation (`<Part>.mjs`) passes or spreads. Accordion's parts
 * write `data-closed` this way while their modules declare `open` alone (KF-072). A mapping that
 * writes `open` inline is not read.
 */
function openAttributes(module: string): string[] {
  const implementation = module.replace(/DataAttributes\.d\.ts$/, ".mjs")
  if (!existsSync(implementation)) return []
  const text = readFileSync(implementation, "utf8")
  const imports = new Map(
    [...text.matchAll(/import \{([^}]*)\} from "(\.[^"]+)\.mjs";/g)].flatMap(
      ([, names, specifier]) =>
        names!.split(",").map((name) => {
          const [exported, local = exported] = name.trim().split(/\s+as\s+/)
          const file = path.resolve(
            path.dirname(implementation),
            `${specifier}.js`
          )
          return [local!, () => require(file)[exported!] as unknown] as const
        })
    )
  )
  const direct = /stateAttributesMapping: (\w+)/.exec(text)?.[1]
  const literal =
    /const stateAttributesMapping = \{([^}]*)\}/.exec(text)?.[1] ?? ""
  if (/\bopen\s*[(:]/.test(literal)) return []
  const spreads = direct
    ? [direct]
    : [...literal.matchAll(/\.\.\.(\w+)/g)].map(([, name]) => name!)
  const mapping = Object.assign(
    {},
    ...spreads.map((name) => imports.get(name)?.())
  ) as { open?: (open: boolean) => Record<string, string> | null }
  if (typeof mapping.open !== "function") return []
  return [true, false].flatMap((open) => Object.keys(mapping.open!(open) ?? {}))
}

/**
 * A part's states with the ones its mapping writes for `open` and its module leaves out
 * (`openAttributes`). One added that way is described as the part's own `open` is, for the other
 * state ("Present when the accordion panel is closed.").
 */
function withOpenStates(module: string, own: State[]): State[] {
  const out = [...own]
  const open = own.find((state) => state.name === "open")
  for (const attribute of openAttributes(module)) {
    if (out.some((state) => state.attribute === attribute)) continue
    const name = attribute
      .slice("data-".length)
      .replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
    const doc = open?.doc.replace(/\bopen\b/, name) ?? ""
    out.splice(open ? out.indexOf(open) + 1 : out.length, 0, {
      name,
      attribute,
      doc,
      values: [],
    })
  }
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
      for (const [name, module] of modules)
        out.set(name, withOpenStates(module, baseUiStates(module)))
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
      if (module)
        byPart.set(exported!, withOpenStates(module, baseUiStates(module)))
    }
    if (byPart.size > 0) out.set(namespace[1]!, byPart)
  }
  return { vocabulary: sorted(out), version }
}

// Ark UI (Zag) ----------------------------------------------------------------------------------

/**
 * Attributes Zag's reference describes in prose ("The orientation of the tabs") although a Zag type
 * fixes their values, by that type in `@zag-js/types` (KF-041). Zag writes the attribute on every
 * such part, so a presence key would match whatever the value.
 */
const ZAG_TYPED: Readonly<Record<string, string>> = {
  "data-orientation": "Orientation",
}

/**
 * The values of each `ZAG_TYPED` type, from the `@zag-js/types` Ark UI installs: its declaration
 * `type Orientation = "horizontal" | "vertical";`, split as `zagState` splits a union.
 */
function zagTypes(arkDirectory: string): Map<string, string[]> {
  const manifest = createRequire(
    path.join(arkDirectory, "package.json")
  ).resolve("@zag-js/types/package.json")
  const text = readFileSync(
    path.join(path.dirname(manifest), "dist/index.d.ts"),
    "utf8"
  )
  const out = new Map<string, string[]>()
  for (const [attribute, type] of Object.entries(ZAG_TYPED)) {
    const start = text.indexOf(`type ${type} = `)
    const values =
      start === -1
        ? []
        : zagState(
            attribute,
            text.slice(
              start + `type ${type} = `.length,
              text.indexOf(";", start)
            )
          ).values
    if (values.length === 0)
      throw new Error(`@zag-js/types no longer declares ${type} as a union`)
    out.set(attribute, values)
  }
  return out
}

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

/**
 * The states each part's prop getter sets, `getRootProps = … => ({ "data-invalid": dataAttr(invalid) })`,
 * with a getter it spreads (`...getControlProps()`), kept to the parts the component exports.
 */
function arkGetters(
  source: string,
  exported: Record<string, unknown>
): Map<string, State[]> {
  const getters = new Map<string, string>()
  for (const [, name, body] of source.matchAll(
    /get(\w+)Props = [^\n]*?\(\) => \(\{([\s\S]*?)\n\t\}\)/g
  ))
    getters.set(name!, body!)
  const attributes = (name: string, depth = 0): string[] => {
    const body = getters.get(name) ?? ""
    const own = [...body.matchAll(/"(data-[a-z][a-z0-9-]*)": dataAttr\(/g)].map(
      (match) => match[1]!
    )
    const spread =
      depth < 3
        ? [...body.matchAll(/\.\.\.get(\w+)Props\(\)/g)].flatMap(([, inner]) =>
            attributes(inner!, depth + 1)
          )
        : []
    return [...own, ...spread]
  }
  const byPart = new Map<string, State[]>()
  for (const name of getters.keys()) {
    if (!(name in exported)) continue
    const list: State[] = []
    for (const attribute of attributes(name)) addState(list, attribute, [])
    if (list.length) byPart.set(name, byName(list))
  }
  return byPart
}

/** An ESTree node, as `oxc-parser` returns it. */
type Node = { type: string; [key: string]: unknown }

/** A node and every node under it, in source order. */
function descendants(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) for (const item of node) descendants(item, out)
  else if (node && typeof node === "object") {
    const current = node as Node
    if (typeof current.type === "string") out.push(current)
    for (const [key, value] of Object.entries(current))
      if (key !== "parent") descendants(value, out)
  }
  return out
}

/** A module's syntax tree, every node in source order; throws if it is missing or does not parse. */
function parsed(file: string): Node[] {
  const name = path.basename(file)
  if (!existsSync(file)) throw new Error(`${name} is missing`)
  const { program, errors } = parseSync(name, readFileSync(file, "utf8"))
  if (errors.length > 0) throw new Error(`${name}: ${errors[0]!.message}`)
  return descendants(program)
}

const identifier = (node: unknown) =>
  (node as Node | null)?.type === "Identifier"
    ? ((node as Node).name as string)
    : undefined

/** The value of each `const` among some nodes, by name, the first of a name kept. */
function declarations(nodes: readonly Node[]): Map<string, Node> {
  const out = new Map<string, Node>()
  for (const node of nodes) {
    const name = identifier(node.id)
    if (
      node.type === "VariableDeclarator" &&
      name &&
      node.init &&
      !out.has(name)
    )
      out.set(name, node.init as Node)
  }
  return out
}

/**
 * What a getter writes on one attribute, over every place it sets it: its presence (`dataAttr(x)`,
 * `x ? "" : void 0`), string literals (`checked ? "checked" : "unchecked"`), or a value it computes
 * (an id, an index, `placement`), which no key can list. `varies` is false for a constant.
 */
type Written = {
  presence: boolean
  values: string[]
  computed: boolean
  varies: boolean
}

/** What an attribute's expression writes, following a `const` it names to that const's value. */
function written(
  expression: Node,
  scope: ReadonlyMap<string, Node>,
  out: Written = {
    presence: false,
    values: [],
    computed: false,
    varies: false,
  },
  seen = new Set<Node>()
): Written {
  const name = identifier(expression)
  const value = expression.value
  if (expression.type === "ConditionalExpression") {
    out.varies = true
    written(expression.consequent as Node, scope, out, seen)
    written(expression.alternate as Node, scope, out, seen)
  } else if (expression.type === "Literal" && typeof value === "string") {
    if (!value) out.presence = true
    else if (!out.values.includes(value)) out.values.push(value)
  } else if (
    (expression.type === "UnaryExpression" && expression.operator === "void") ||
    (expression.type === "Literal" && value === null) ||
    name === "undefined"
  ) {
    // The attribute left off.
  } else if (
    expression.type === "CallExpression" &&
    identifier(expression.callee) === "dataAttr"
  ) {
    out.presence = true
    out.varies = true
  } else if (name && scope.has(name) && !seen.has(scope.get(name)!)) {
    seen.add(scope.get(name)!)
    written(scope.get(name)!, scope, out, seen)
  } else out.computed = true
  return out
}

/** A `Written` merged into the one already kept for its attribute. */
function merge(into: Map<string, Written>, attribute: string, more: Written) {
  const known = into.get(attribute)
  if (!known) {
    into.set(attribute, more)
    return
  }
  known.presence ||= more.presence
  known.computed ||= more.computed
  known.varies ||= more.varies
  for (const value of more.values)
    if (!known.values.includes(value)) known.values.push(value)
}

/**
 * The `data-*` attributes a getter (or a helper it spreads) sets, in source order: each
 * `"data-x": …` under it, and what it spreads from a function of the module
 * (`...getItemDataAttrs(props)`, as Radio Group's item parts do, KF-087) or from a const
 * (`...dataAttrs`, as Checkbox's parts do). What it merges is read as spread, and another
 * machine's getter as this module's of that name: Menu's `getTriggerItemProps` returns
 * `mergeProps(getItemProps(…), childApi.getTriggerProps())` (R3-FIX-27).
 */
function getterAttributes(
  root: Node,
  module: {
    functions: ReadonlyMap<string, Node>
    shared: Map<string, Node>
    getters: ReadonlyMap<string, Node>
  },
  out = new Map<string, Written>(),
  seen = new Set<Node>()
): Map<string, Written> {
  if (seen.has(root)) return out
  seen.add(root)
  const nodes = descendants(root)
  const scope = new Map([...module.shared, ...declarations(nodes)])
  const called = (expression: Node | undefined) => {
    if (expression?.type !== "CallExpression") return undefined
    const callee = expression.callee as Node
    return callee.type === "MemberExpression"
      ? module.getters.get(identifier(callee.property) ?? "")
      : module.functions.get(identifier(callee) ?? "")
  }
  for (const node of nodes) {
    const key = (node.key as Node | undefined)?.value
    if (
      node.type === "Property" &&
      !node.computed &&
      typeof key === "string" &&
      key.startsWith("data-")
    )
      merge(out, key, written(node.value as Node, scope))
    const spread =
      node.type === "SpreadElement"
        ? [node.argument as Node]
        : node.type === "CallExpression" &&
            identifier(node.callee) === "mergeProps"
          ? (node.arguments as Node[])
          : []
    for (const argument of spread) {
      const named = scope.get(identifier(argument) ?? "")
      const target = called(argument) ?? called(named) ?? named
      if (target) getterAttributes(target, module, out, seen)
    }
  }
  return out
}

/**
 * What each prop getter in a Zag machine's `connect` sets (KF-087), by getter: the methods of the
 * object `connect` returns, `getItemControlProps(props) { return normalize.element({ … }) }`, or a
 * function it names there (`getItemProps,`). Zag's reference leaves some of them out: Radio Group's
 * `Item` and `ItemText`, and all but `data-active` on its `ItemControl`. Another function that
 * returns getters is read the same way (`connectStack`, Ark UI's `usePresence`, R3-FIX-27). Read by
 * the module's syntax tree, and throws if the shape is gone, so a Zag release that changes it fails
 * here rather than generating less.
 */
function zagConnect(
  file: string,
  fn = "connect"
): Map<string, Map<string, Written>> {
  const name = path.basename(file)
  const all = parsed(file)
  const connect =
    all.find(
      (node) =>
        node.type === "FunctionDeclaration" && identifier(node.id) === fn
    ) ?? declarations(all).get(fn)
  const statements = ((connect?.body as Node | undefined)?.body ?? []) as Node[]
  const returned = statements.find(
    (statement) =>
      statement.type === "ReturnStatement" &&
      (statement.argument as Node | null)?.type === "ObjectExpression"
  )?.argument as Node | undefined
  if (!returned)
    throw new Error(`${name} no longer returns its getters from ${fn}()`)
  // The module's functions, `function getItemDataAttrs(props) { … }` or a const holding one.
  const functions = new Map<string, Node>()
  for (const node of all) {
    const declared = identifier(node.id)
    if (
      node.type === "FunctionDeclaration" &&
      declared &&
      !functions.has(declared)
    )
      functions.set(declared, node)
  }
  for (const [declared, init] of declarations(all))
    if (init.type.includes("Function") && !functions.has(declared))
      functions.set(declared, init)
  // The consts of `connect`'s body and of the module (`const dataAttrs = { … }`), not those of
  // another getter's body.
  const shared = declarations(
    [...statements, ...(all[0]!.body as Node[])].flatMap((statement) =>
      statement.type === "VariableDeclaration"
        ? (statement.declarations as Node[])
        : []
    )
  )
  // Each getter's function, `getItemProps` or one without `Props` (Splitter's
  // `getResizeTriggerIndicator`), so another machine's call of one can be followed.
  const getters = new Map<string, Node>()
  for (const property of returned.properties as Node[]) {
    const key = identifier(property.key) ?? ""
    if (property.type !== "Property" || !/^get[A-Z]/.test(key)) continue
    const value = property.value as Node
    const named = identifier(value)
    const getter = named ? functions.get(named) : value
    if (!getter && key.endsWith("Props"))
      throw new Error(
        `${fn}() returns ${key}, which ${name} no longer declares`
      )
    if (getter?.type.includes("Function")) getters.set(key, getter)
  }
  if (![...getters.keys()].some((key) => key.endsWith("Props")))
    throw new Error(`${name} no longer has prop getters`)
  return new Map(
    [...getters].map(([key, getter]) => [
      key,
      getterAttributes(getter, { functions, shared, getters }),
    ])
  )
}

/**
 * Attributes a getter writes that name no state a style keys on: `data-scope` and `data-part` name
 * the part on every element of it, `data-ownedby` carries an id, `data-index` and `data-value` an
 * item's index and value, and `data-ssr` marks the server's render until the client takes over.
 * Any other attribute whose value is computed (`data-placement`) or constant (`data-lpignore`) is
 * left out too.
 */
const ZAG_NOT_STATES = new Set([
  "data-scope",
  "data-part",
  "data-ownedby",
  "data-index",
  "data-value",
  "data-ssr",
])

/**
 * A state from what a getter writes, or none: a presence, the string literals it writes (one key
 * each), or the values of its `ZAG_TYPED` type when it writes a computed one (`prop("orientation")`).
 */
function connectState(
  attribute: string,
  wrote: Written,
  typed: ReadonlyMap<string, string[]>
): State | undefined {
  if (ZAG_NOT_STATES.has(attribute)) return undefined
  const name = camel(attribute.replace(/^data-/, ""))
  if (wrote.computed)
    return typed.has(attribute)
      ? { name, attribute, doc: "", values: [...typed.get(attribute)!] }
      : undefined
  // A constant, or a presence and values on one attribute, which one key shape cannot hold.
  if (!wrote.varies || (wrote.presence && wrote.values.length > 0))
    return undefined
  return { name, attribute, doc: "", values: wrote.values }
}

/**
 * The description Zag's reference gives an attribute's presence ("Present when hovered"), for one
 * only the machine's code sets: the one the machine uses most, or else the reference as a whole.
 */
function presenceDocs(
  reference: Record<string, Record<string, Record<string, string>>>
) {
  const counts = (entries: Record<string, Record<string, string>>[]) => {
    const out = new Map<string, Map<string, number>>()
    for (const parts of entries)
      for (const attributes of Object.values(parts))
        for (const [attribute, described] of Object.entries(attributes)) {
          if (!described.startsWith("Present when ")) continue
          const seen = out.get(attribute) ?? new Map<string, number>()
          seen.set(described, (seen.get(described) ?? 0) + 1)
          out.set(attribute, seen)
        }
    return out
  }
  const most = (seen: Map<string, number> | undefined) =>
    [...(seen ?? [])].reduce<[string, number] | undefined>(
      (best, entry) => (best && best[1] >= entry[1] ? best : entry),
      undefined
    )?.[0]
  const everywhere = counts(Object.values(reference))
  return (machine: string, attribute: string) =>
    most(counts([reference[machine] ?? {}]).get(attribute)) ??
    most(everywhere.get(attribute)) ??
    ""
}

/** An Ark UI component's folder: `dist/components/segment-group`. */
const arkFolder = (arkDirectory: string, name: string) =>
  path.join(
    arkDirectory,
    "dist/components",
    name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
  )

/** An Ark UI component's hook: `dist/components/segment-group/use-segment-group.js`. */
function arkHook(arkDirectory: string, name: string): string {
  const folder = arkFolder(arkDirectory, name)
  return path.join(folder, `use-${path.basename(folder)}.js`)
}

/**
 * Each part's module, by the component's own (`menu/menu.js`): `export { MenuCheckboxItem as
 * CheckboxItem }` of `import { MenuCheckboxItem } from "./menu-checkbox-item.js"` (R3-FIX-27).
 */
function arkPartFiles(arkDirectory: string, name: string): Map<string, string> {
  const folder = arkFolder(arkDirectory, name)
  const all = parsed(path.join(folder, `${path.basename(folder)}.js`))
  const imported = new Map<string, string>()
  for (const node of all)
    if (node.type === "ImportDeclaration")
      for (const specifier of node.specifiers as Node[])
        imported.set(
          identifier(specifier.local)!,
          (node.source as Node).value as string
        )
  const out = new Map<string, string>()
  for (const node of all)
    if (node.type === "ExportNamedDeclaration")
      for (const specifier of node.specifiers as Node[]) {
        const source = imported.get(identifier(specifier.local) ?? "")
        if (source?.startsWith("./"))
          out.set(identifier(specifier.exported)!, path.join(folder, source))
      }
  return out
}

/**
 * The getters whose props an Ark UI part merges onto its element, in source order: each
 * `menu.getOptionItemProps(…)` among the arguments of its `mergeProps(…)`, through the consts they
 * name, as Date Picker's `TableCell` takes one per view from `{ day: datePicker.getDayTableCellProps,
 * … }` (R3-FIX-27). A getter it calls for something else (an id, a child's props) is not merged.
 */
function arkCalls(file: string): string[] {
  const all = parsed(file)
  const scope = declarations(all)
  const out: string[] = []
  const seen = new Set<Node>()
  const visit = (root: Node) => {
    if (seen.has(root)) return
    seen.add(root)
    for (const node of descendants(root)) {
      const property = identifier(node.property)
      if (
        node.type === "MemberExpression" &&
        !node.computed &&
        property &&
        /^get[A-Z]/.test(property) &&
        !out.includes(property)
      )
        out.push(property)
      const named = scope.get(identifier(node) ?? "")
      if (named) visit(named)
    }
  }
  for (const node of all)
    if (
      node.type === "CallExpression" &&
      identifier(node.callee) === "mergeProps"
    )
      for (const argument of node.arguments as Node[]) visit(argument)
  return out
}

/**
 * The getters of a Zag machine's `connect`, then those of any other `connect…` its package's index
 * imports, under names `connect` does not use: Drawer's `connectStack` has `getIndentProps`
 * (R3-FIX-27).
 */
function zagGetters(directory: string, machine: string) {
  const dist = path.join(directory, "dist")
  const out = zagConnect(path.join(dist, `${machine}.connect.mjs`))
  for (const node of parsed(path.join(dist, "index.mjs"))) {
    if (node.type !== "ImportDeclaration") continue
    for (const specifier of node.specifiers as Node[]) {
      const fn = identifier(specifier.imported)
      if (!fn?.startsWith("connect") || fn === "connect") continue
      const file = path.join(dist, (node.source as Node).value as string)
      for (const [getter, attributes] of zagConnect(file, fn))
        if (!out.has(getter)) out.set(getter, attributes)
    }
  }
  return out
}

/** The Zag machine a hook runs, by the `@zag-js/<machine>` it imports beside `@zag-js/react`. */
function arkMachine(hook: string): string | undefined {
  if (!existsSync(hook)) return undefined
  return [...readFileSync(hook, "utf8").matchAll(/from "@zag-js\/([a-z-]+)"/g)]
    .map(([, machine]) => machine!)
    .find((machine) => machine !== "react")
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
  const { directory: arkDirectory } = installed("@ark-ui/react")
  const typed = zagTypes(arkDirectory)
  const describe = presenceDocs(reference)
  const zag = createRequire(path.join(arkDirectory, "package.json"))
  const machines = new Map(
    Object.keys(reference).map((machine) => [pascal(machine), machine])
  )
  // A component the reference names otherwise runs the machine its hook imports: Segment Group's
  // imports `@zag-js/radio-group` (KF-087).
  for (const name of Object.keys(ark)) {
    if (machines.has(name)) continue
    const machine = arkMachine(arkHook(arkDirectory, name))
    if (machine && machine in reference) machines.set(name, machine)
  }
  // What Ark UI's presence hook merges onto a part that mounts and unmounts (R3-FIX-27).
  const presence = zagConnect(
    path.join(arkFolder(arkDirectory, "Presence"), "use-presence.js"),
    "usePresence"
  )
  const out: Vocabulary = new Map()
  for (const [name, machine] of machines) {
    const exported = ark[name]
    if (!exported || typeof exported !== "object") continue
    // A value one source's union leaves out; a presence the reference describes stays one.
    const add = (list: State[], state: State) => {
      const known = list.find((other) => other.attribute === state.attribute)
      if (!known) list.push(state)
      else if (known.values.length)
        for (const value of state.values)
          if (!known.values.includes(value)) known.values.push(value)
    }
    const fromReference = (list: State[], part: string) => {
      for (const [attribute, described] of Object.entries(
        reference[machine]![part] ?? {}
      )) {
        // `data-scope` and `data-part` name the part on every element of it: not states.
        if (attribute === "data-scope" || attribute === "data-part") continue
        const state = zagState(attribute, described)
        const values = state.values.length ? undefined : typed.get(attribute)
        add(list, values ? { ...state, values } : state)
      }
    }
    const fromGetter = (list: State[], attributes: Map<string, Written>) => {
      for (const [attribute, wrote] of attributes) {
        const state = connectState(attribute, wrote, typed)
        if (state)
          add(list, {
            ...state,
            doc: state.values.length ? "" : describe(machine, attribute),
          })
      }
    }
    const byPart = new Map<string, State[]>()
    for (const part of Object.keys(reference[machine]!)) {
      if (!(part in exported)) continue
      const list: State[] = []
      fromReference(list, part)
      byPart.set(part, list)
    }
    if (byPart.size === 0) continue
    // What the reference leaves out, after what it gives, which keeps its descriptions (KF-087).
    const manifest = zag.resolve(`@zag-js/${machine}/package.json`)
    const getters = zagGetters(path.dirname(manifest), machine)
    for (const [getter, attributes] of getters) {
      const part = /^get(\w+)Props$/.exec(getter)?.[1]
      if (!part || !(part in exported)) continue
      const list = byPart.get(part) ?? []
      fromGetter(list, attributes)
      if (list.length > 0 || byPart.has(part)) byPart.set(part, list)
    }
    // A part whose module merges another part's getter, or several, has their states after its own
    // (R3-FIX-27): Menu's `CheckboxItem` merges `getOptionItemProps`, Date Picker's `TableCell` one
    // getter per view, a part that mounts and unmounts `usePresence`'s. `RootProvider` renders
    // `Root`'s element for a machine made elsewhere, so `Root`'s keys are its.
    const files = arkPartFiles(arkDirectory, name)
    for (const part of Object.keys(exported)) {
      if (!/^[A-Z]/.test(part) || part === "RootProvider") continue
      const file = files.get(part)
      if (!file)
        throw new Error(`${name}.${part} is no longer exported by its module`)
      const merged = arkCalls(file).filter(
        (getter) => getter !== `get${part}Props`
      )
      if (merged.length === 0) continue
      const list = byPart.get(part) ?? []
      for (const getter of merged)
        fromReference(list, getter.replace(/^get|Props$/g, ""))
      for (const getter of merged) {
        const attributes = getters.get(getter) ?? presence.get(getter)
        if (!attributes)
          throw new Error(
            `${name}.${part} merges ${getter}, which neither ${machine}'s connect nor usePresence returns`
          )
        fromGetter(list, attributes)
      }
      if (list.length > 0) byPart.set(part, list)
    }
    out.set(name, byPart)
  }
  // Ark's own components, with no Zag machine (Field, Fieldset): each part's prop getter in
  // `use-<name>.js` sets its states.
  for (const [name, exported] of Object.entries(ark)) {
    if (out.has(name) || !exported || typeof exported !== "object") continue
    const hook = arkHook(arkDirectory, name)
    if (!existsSync(hook)) continue
    const byPart = arkGetters(readFileSync(hook, "utf8"), exported)
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
  // `export declare class X {`, or `… implements Y {`.
  const start = text.search(
    new RegExp(`export declare class ${className}\\b[^{\\n]*\\{`)
  )
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

/**
 * The state classes a Bits UI part creates, as `[declaration module, class]`, and those of the
 * library's own components it renders (`ScrollArea.Scrollbar` renders a scrollbar per mode, whose
 * classes set `data-state`).
 */
function bitsStates(file: string, depth = 0): [string, string][] {
  const text = readFileSync(file, "utf8")
  const out: [string, string][] = []
  for (const [, className] of text.matchAll(/(\w+State)\.create\(/g)) {
    const module = new RegExp(
      `import \\{[^}]*\\b${className}\\b[^}]*\\} from "([^"]+)\\.js"`
    ).exec(text)?.[1]
    if (module)
      out.push([path.join(path.dirname(file), `${module}.d.ts`), className!])
  }
  if (depth < 3)
    for (const [, inner] of text.matchAll(
      /import \w+ from "(\.[^"]+\.svelte)"/g
    )) {
      const target = path.join(path.dirname(file), inner!)
      if (existsSync(target)) out.push(...bitsStates(target, depth + 1))
    }
  return out
}

function bitsUi(): { vocabulary: Vocabulary; version: string } {
  const { directory, version } = installed("bits-ui")
  const bits = path.join(directory, "dist/bits")
  const out: Vocabulary = new Map()
  // `export { Command, computeCommandScore } from "./command/index.js"`: the component is the name
  // in capitals; the others are its helpers.
  const components = [
    ...readFileSync(path.join(bits, "index.d.ts"), "utf8").matchAll(
      /export \{ ([^}]+) \} from "\.\/([\w-]+)\/index\.js"/g
    ),
  ].flatMap(([, names, folder]) =>
    names!
      .split(",")
      .map((name) => name.trim())
      .filter((name) => /^[A-Z]/.test(name))
      .map((name) => [name, folder!] as const)
  )
  for (const [component, folder] of components) {
    const exports = path.join(bits, folder!, "exports.d.ts")
    if (!existsSync(exports)) continue
    const byPart = new Map<string, State[]>()
    for (const [, part, from] of readFileSync(exports, "utf8").matchAll(
      /export \{ default as (\w+) \} from "([^"]+)\.svelte"/g
    )) {
      const file = path.join(bits, folder!, `${from}.svelte`)
      if (!existsSync(file)) continue
      const list: State[] = []
      for (const [module, className] of bitsStates(file)) {
        for (const [attribute, values] of bitsProps(module, className)) {
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
  const typings = path.join(directory, "types")
  // Every entry point's declarations: a type is declared in one and used in another
  // (`NgpOrientation` in `ng-primitives/common`).
  const everyEntry = readdirSync(typings)
    .filter((entry) => entry.endsWith(".d.ts"))
    .map((entry) => readFileSync(path.join(typings, entry), "utf8"))
    .join("\n")
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
    const types = {
      own: readFileSync(
        path.join(typings, `ng-primitives-${entry}.d.ts`),
        "utf8"
      ),
      all: everyEntry,
    }
    for (const block of blocks) {
      const name = /^createPrimitive\('Ngp(\w+)'/.exec(block)![1]!
      // The block's own directive: a primitive another one only uses has no class of its own.
      if (!text.includes(`class Ngp${name} {`)) continue
      const part = partName(name, component) ?? name
      const list: State[] = []
      for (const [, attribute, expression] of block.matchAll(
        /dataBinding\(\w+, '(data-[a-z][a-z0-9-]*)', ([^\n]*)\);/g
      ))
        addState(list, attribute!, boundValues(name, expression!, block, types))
      const interactions =
        /ngpInteractions\(\{([^}]*)\}\)/.exec(block)?.[1] ?? ""
      for (const [key, attribute] of Object.entries(INTERACTIONS))
        if (new RegExp(`\\b${key}\\s*:\\s*(?!false)`).test(interactions))
          addState(list, attribute, [])
      if (list.length) byPart.set(part, byName(list))
    }
    // Directives written without `createPrimitive` (Combobox, Toast, Radio's indicator) bind their
    // states in their declaration's `host.properties` (KF-099).
    for (const [, call] of text.matchAll(
      /ɵɵngDeclareDirective\((\{[^\n]*\})\); \}/g
    )) {
      const name = /type: Ngp(\w+),/.exec(call!)![1]!
      const part = partName(name, component) ?? name
      const list = byPart.get(part) ?? []
      for (const [, attribute, raw] of call!.matchAll(
        /"attr\.(data-[a-z][a-z0-9-]*)": "((?:[^"\\]|\\.)*)"/g
      ))
        addState(
          list,
          attribute!,
          hostValues(
            component,
            name,
            attribute!,
            JSON.parse(`"${raw}"`) as string,
            types
          )
        )
      if (list.length) byPart.set(part, byName(list))
    }
    if (byPart.size) out.set(component, byPart)
  }
  return { vocabulary: sorted(out), version }
}

/**
 * Values Angular Primitives computes rather than declares, by component and attribute: Toast splits
 * its placement (`'top-start' | … | 'bottom-center'`) at the hyphen, `|| 'end'` and `|| 'top'`.
 */
const NG_COMPUTED: Readonly<Record<string, readonly string[]>> = {
  "Toast data-position-x": ["start", "center", "end"],
  "Toast data-position-y": ["top", "bottom"],
}

/** An entry point's declarations, and every entry point's, where its types are declared. */
interface NgTypes {
  own: string
  all: string
}

/**
 * The values a `dataBinding` writes: the literals its expression returns
 * (`() => (open() ? 'open' : 'closed')`), or else those of the type it reads, which a boolean
 * gives none of, since `dataBinding` writes `true` as a presence (KF-100): a signal of the block
 * (`const status = signal(NgpAvatarStatus.Idle)`) is first looked up by its own definition, then
 * as a member declared on the directive's class or anywhere in its entry point
 * (`orientation?: Signal<NgpOrientation>`). A number, a string or anything unresolved stays a
 * presence.
 */
function boundValues(
  directive: string,
  expression: string,
  block: string,
  types: NgTypes
): string[] {
  const values = valuesIn(expression)
  if (values.length || /\?\s*''\s*:\s*null\)$/.test(expression)) return values
  const member = memberOf(expression)
  const local = new RegExp(`const ${member} = computed\\(([^\\n]*)`).exec(
    block
  )?.[1]
  // Its development build's `debugName: "status"` is no value.
  if (local) return valuesIn(local.split(", ...(ngDevMode")[0]!)
  return enumerated(declaredType(directive, member, types), types.all)
}

/** The member an expression reads last: `() => overlay.finalPlacement()?.toString() ?? null`. */
function memberOf(expression: string): string {
  return (
    /(\w+)(?:\(\))?$/.exec(
      expression
        .replace(/\s*\?\?\s*null$/, "")
        .replace(/\??\.toString\(\)$/, "")
    )?.[1] ?? ""
  )
}

/**
 * A member's declared type, on the directive's class in its entry point's declarations, then
 * anywhere in them (`options.expanded()`), then in another entry point's (an overlay's
 * `finalPlacement`), with a signal unwrapped.
 */
function declaredType(directive: string, member: string, types: NgTypes) {
  const start = types.own.indexOf(`declare class Ngp${directive} `)
  const own =
    start < 0
      ? ""
      : types.own.slice(start, types.own.indexOf("\ndeclare ", start + 1))
  // A member, not a parameter (`setStatus(status: NgpAvatarStatus)`).
  const typeOf = (text: string) =>
    new RegExp(`(?<!\\(|, )\\b${member}\\??: ([^;]+);`).exec(text)?.[1]
  return (typeOf(own) ?? typeOf(types.own) ?? typeOf(types.all) ?? "").replace(
    /^(?:\w+\.)?(?:Writable|Input)?Signal<(.*)>$/,
    "$1"
  )
}

/**
 * The string values a type fixes: its literals, through aliases and string enums declared in any
 * entry point (`NgpOrientation`, `NgpAvatarStatus`), `null` and `undefined` left out. None when
 * any member is something else.
 */
function enumerated(type: string, source: string): string[] {
  const out: string[] = []
  for (const member of type.split("|").map((part) => part.trim())) {
    if (member === "null" || member === "undefined") continue
    const literal = /^(['"])([^'"]+)\1$/.exec(member)?.[2]
    if (literal) {
      out.push(literal)
      continue
    }
    if (!/^\w+$/.test(member)) return []
    const alias = new RegExp(`\\btype ${member} = ([^;]+);`).exec(source)?.[1]
    const members = new RegExp(`\\benum ${member} \\{([^}]*)\\}`).exec(
      source
    )?.[1]
    const values = alias
      ? enumerated(alias, source)
      : [...(members ?? "").matchAll(/= "([^"]+)"/g)].map((match) => match[1]!)
    if (!values.length) return []
    out.push(...values)
  }
  return [...new Set(out)]
}

/**
 * The values a host binding writes (`"attr.data-open": "open() ? \"\" : undefined"`): none for a
 * presence; `true` and `false` for a boolean, which Angular writes as text; the values of a
 * declared type (`declaredType`, `enumerated`); `NG_COMPUTED` for the rest. Anything else is an
 * error, so a release that binds a state some new way is caught here.
 */
function hostValues(
  component: string,
  directive: string,
  attribute: string,
  expression: string,
  types: NgTypes
): string[] {
  if (/\?\s*""\s*:\s*(?:undefined|null)$/.test(expression)) return []
  if (/[=!]==/.test(expression)) return ["false", "true"]
  const declared = declaredType(directive, memberOf(expression), types)
  if (declared === "boolean") return ["false", "true"]
  const union = enumerated(declared, types.all)
  if (union.length) return union
  const computed = NG_COMPUTED[`${component} ${attribute}`]
  if (computed) return [...computed]
  throw new Error(
    `ng-primitives: the values of ${component}'s ${attribute} (${expression}) are unknown`
  )
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
  ["pristine", "dirty"],
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
      `// @generated by scripts/gen-states.ts from @zag-js/docs ${ark.version} and the prop getters of the`,
      "// Zag machines Ark UI is built on (MIT, Copyright (c) 2021 Chakra UI), with the parts and the",
      "// getters each merges from Ark UI's components (MIT, Copyright (c) 2024 Chakra UI): the",
      "// descriptions are Zag's. Do not edit.",
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
