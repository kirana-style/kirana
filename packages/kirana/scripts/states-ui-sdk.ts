/**
 * The ui-sdk vocabulary of `@kirana-style/states`, read from the part definitions of
 * `@ui-sdk/core` (Apache-2.0, Vercel Labs), the one core that writes the attributes for every
 * ui-sdk adapter, so one vocabulary serves React, Vue, Svelte, Solid and the web (KF-125). The
 * release is pinned exactly: a beta, regenerated on every bump.
 *
 * Each component calls `definePrimitive({ name, slots: (slot) => ({ … }) })`, and each slot's
 * `attrs(state, part)` returns the attributes its element carries; the kernel adds `data-slot`
 * (`name` for the root slot, `name-slot` for the others). What a part writes is read from its code,
 * by its syntax tree (`oxc-parser`), never by running it:
 *
 * - the `"data-*"` keys of the object `attrs` returns, through the spreads it makes of a helper
 *   (`...openAttrs(state.open)`), of another slot's `attrs` (`...trigger.attrs(state, part)` from
 *   `popupTrigger(slot)`), or of a slot it is built from (`slot({ ...root, … })`), across files,
 *   each function once; and of what `live(read)` writes as the part changes;
 * - what its `bind(el, part)` writes on `el` itself (`el.toggleAttribute("data-checked", …)`), and in
 *   the functions it hands `el` to (`animateIn(el)` writes `data-starting-style`); and what the
 *   component's modules write on a part's element they look up by slot (`element("content")`);
 * - a call on an object the api builds at run time (`api.internal.press.triggerAttrs(…)`) is read
 *   as the methods of that name the package defines (`Collected.methods`);
 * - two writers nothing in a part's code names, read from their own code: the popup layer
 *   (`popupLayer`), which animates a popup's element and backdrop in and out, and the positioner
 *   (`positioner`), which writes `data-side` and `data-align` on a placed popup and its arrow.
 *
 * A value is the attribute's presence (`open ? "" : undefined`) or the string literals it writes,
 * with the union of string literals a typed field holds (`"data-side": state.side`, typed in the
 * package's `.d.ts`); a value no type lists (a number, an id) leaves its presence alone. Attributes
 * that carry an identifier rather than a state are left out (`UI_SDK_NOT_STATES`), as are markers
 * written as one constant.
 *
 * The components are the parts of every primitive under `dist/components/`, and of the features a
 * renderer adds to one (`menuCheckable` gives Menu its `checkbox-item`), merged by `name`: Checkbox's
 * group parts are Checkbox's, as their `data-slot` (`checkbox-group`) says.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { parseSync } from "oxc-parser"

const require = createRequire(import.meta.url)

/** As in `gen-states.ts`. */
export type State = {
  name: string
  /** The attribute, for a state its selector reads by presence or value. */
  attribute: string
  doc: string
  values: string[]
  /** A selector that is not an attribute's presence (`:not([aria-valuenow])`). */
  selector?: string
  /** Also written with no value, beside its values: its `any` key is the attribute's presence. */
  presence?: boolean
  /** Endings several values share where none is the ending itself. */
  endings?: string[]
}
/** Components, each with its parts' states, or its own states when it has no parts. */
export type Vocabulary = Map<string, Map<string, State[]> | State[]>

/**
 * Attributes a part writes that name no state a style keys on, each with why. Any other attribute
 * written as one constant (a marker every such element carries) is left out too.
 */
export const UI_SDK_NOT_STATES: ReadonlyMap<string, string> = new Map([
  ["data-slot", "names the part on every element of it"],
  ["data-span-id", "carries a waterfall span's id"],
  ["data-index", "carries an item's index"],
  ["data-value", "echoes an item's value"],
  ["data-token-id", "carries a token's id"],
  ["data-level", "carries a tree item's depth, a number"],
  [
    "data-snap-point",
    "echoes the snap point a drawer rests on, a number or a length",
  ],
  [
    "data-channel",
    "names the colour channel an input edits, which its props set",
  ],
  [
    "data-agent-hidden",
    "marks a part for ui-sdk's agent tooling, not for styles",
  ],
  [
    "data-agent-confirm",
    "marks a part for ui-sdk's agent tooling, not for styles",
  ],
  [
    "data-agent-secret",
    "marks a part for ui-sdk's agent tooling, not for styles",
  ],
  ["data-review-loc", "points ui-sdk's review tooling at source code"],
  [
    "data-scroll-guard",
    "marks a modal popup for ui-sdk's own overscroll rule while it locks the page's scroll",
  ],
])

// Reading modules -------------------------------------------------------------------------------

/** An ESTree node, as `oxc-parser` returns it. */
type Node = { type: string; start: number; end: number; [key: string]: unknown }

type Module = {
  file: string
  text: string
  program: Node
  comments: { type: string; value: string; start: number; end: number }[]
  env: Env
  /** Exported name → binding. */
  exported: Map<string, () => Binding | undefined>
}

/** What a name stands for: an expression in its scope, a member of another binding, or nothing known. */
type Binding =
  | { node: Node; env: Env }
  | { of: Binding; key: string }
  | { opaque: string }
  | { link: () => Binding | undefined }

type Env = { module: Module; vars: Map<string, Binding>; parent?: Env }

/** A value as far as it can be read without running the code. */
type Value =
  | { kind: "object"; entries: Entry[] }
  | { kind: "function"; node: Node; env: Env }
  /** `partial` when some of the options could not be read. */
  | { kind: "union"; options: Value[]; partial?: boolean }
  | { kind: "literal"; value: unknown }
  | { kind: "unknown" }
type Entry = { key: string; node: Node; env: Env } | { spread: Node; env: Env }

const UNKNOWN: Value = { kind: "unknown" }

const modules = new Map<string, Module>()

const isFunction = (node: Node | undefined) =>
  !!node &&
  (node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration")

/** Every node under `node`, in source order, nested functions included unless `shallow`. */
function walk(node: unknown, visit: (node: Node) => void, shallow = false) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit, shallow)
    return
  }
  if (!node || typeof node !== "object") return
  const current = node as Node
  if (typeof current.type === "string") visit(current)
  for (const [key, value] of Object.entries(current)) {
    if (key === "parent" || !value || typeof value !== "object") continue
    if (shallow && isFunction(value as Node)) continue
    walk(value, visit, shallow)
  }
}

const name = (node: unknown) =>
  (node as Node | null)?.type === "Identifier"
    ? ((node as Node).name as string)
    : undefined

/** A property's key, `foo` or `"data-foo"`, when it is not computed. */
function keyOf(property: Node): string | undefined {
  if (property.computed) return undefined
  const key = property.key as Node
  if (key.type === "Identifier") return key.name as string
  if (key.type === "Literal" && typeof key.value === "string") return key.value
  return undefined
}

/** A module of the package, parsed once. */
function load(file: string): Module {
  const known = modules.get(file)
  if (known) return known
  const text = readFileSync(file, "utf8")
  const { program, comments, errors } = parseSync(path.basename(file), text)
  if (errors.length > 0)
    throw new Error(`${path.basename(file)}: ${errors[0]!.message}`)
  const module = {
    file,
    text,
    program: program as unknown as Node,
    comments: comments as Module["comments"],
    exported: new Map(),
  } as unknown as Module
  module.env = { module, vars: new Map() }
  modules.set(file, module)
  const body = (program as unknown as Node).body as Node[]
  const local = (specifier: string) =>
    specifier.startsWith(".")
      ? path.resolve(path.dirname(file), specifier)
      : undefined
  for (const statement of body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement.declaration as Node | null)
        : statement
    if (declaration) bindDeclarations(declaration, module.env, true)
    if (statement.type === "ImportDeclaration") {
      const from = local((statement.source as Node).value as string)
      for (const specifier of statement.specifiers as Node[]) {
        const as = name(specifier.local)!
        const imported =
          specifier.type === "ImportSpecifier"
            ? (name(specifier.imported) ??
              ((specifier.imported as Node).value as string))
            : undefined
        module.env.vars.set(as, {
          link: () =>
            from && imported && existsSync(from)
              ? load(from).exported.get(imported)?.()
              : undefined,
        })
      }
    }
    if (statement.type === "ExportNamedDeclaration") {
      const from = statement.source
        ? local((statement.source as Node).value as string)
        : undefined
      for (const specifier of statement.specifiers as Node[]) {
        const exported = name(specifier.exported)!
        const own = name(specifier.local)!
        module.exported.set(exported, () =>
          from ? load(from).exported.get(own)?.() : module.env.vars.get(own)
        )
      }
      if (declaration)
        for (const declared of declaredNames(declaration))
          module.exported.set(declared, () => module.env.vars.get(declared))
    }
  }
  return module
}

function declaredNames(declaration: Node): string[] {
  if (declaration.type === "FunctionDeclaration") return [name(declaration.id)!]
  if (declaration.type === "VariableDeclaration")
    return (declaration.declarations as Node[]).flatMap((declarator) => {
      const declared = name(declarator.id)
      return declared ? [declared] : []
    })
  return []
}

/** Binds the names a declaration introduces (`const { a } = b`, `function f() {}`) into `env`. */
function bindDeclarations(statement: Node, env: Env, topLevel = false) {
  if (statement.type === "FunctionDeclaration") {
    const declared = name(statement.id)
    if (declared && (!topLevel || !env.vars.has(declared)))
      env.vars.set(declared, { node: statement, env })
  } else if (statement.type === "VariableDeclaration")
    for (const declarator of statement.declarations as Node[])
      if (declarator.init)
        bindPattern(
          declarator.id as Node,
          { node: declarator.init as Node, env },
          env
        )
}

/** Binds a pattern's names to the parts of `binding` they take. */
function bindPattern(pattern: Node, binding: Binding | undefined, env: Env) {
  if (pattern.type === "Identifier")
    env.vars.set(
      pattern.name as string,
      binding ?? { opaque: pattern.name as string }
    )
  else if (pattern.type === "AssignmentPattern")
    bindPattern(
      pattern.left as Node,
      binding ?? { node: pattern.right as Node, env },
      env
    )
  else if (pattern.type === "ObjectPattern")
    for (const property of pattern.properties as Node[]) {
      // The rest is read as the whole object: what it leaves out is named, never a `data-*`.
      if (property.type === "RestElement") {
        bindPattern(property.argument as Node, binding, env)
        continue
      }
      const key = keyOf(property)
      const value = property.value as Node
      bindPattern(value, key && binding ? { of: binding, key } : undefined, env)
    }
  else if (pattern.type === "ArrayPattern")
    for (const element of pattern.elements as (Node | null)[])
      if (element) bindPattern(element, undefined, env)
}

function lookup(env: Env | undefined, variable: string): Binding | undefined {
  for (let scope = env; scope; scope = scope.parent) {
    const found = scope.vars.get(variable)
    if (found) return found
  }
  return undefined
}

/** A binding with its links followed. */
type Settled = Exclude<Binding, { link: unknown }>

function settle(binding: Binding | undefined): Settled | undefined {
  let current = binding
  for (let hops = 0; current && "link" in current && hops < 20; hops++)
    current = current.link()
  return current && "link" in current ? undefined : current
}

// Evaluating ------------------------------------------------------------------------------------

/** Calls in progress, so a function that recurses is read once. */
const calling = new Set<Node>()

const unwrap = (node: Node): Node =>
  node.type === "ParenthesizedExpression" ||
  node.type === "ChainExpression" ||
  node.type === "TSAsExpression" ||
  node.type === "TSNonNullExpression"
    ? unwrap(node.expression as Node)
    : node

function union(options: Value[]): Value {
  const known = options.filter((option) => option.kind !== "unknown")
  if (known.length === 0) return UNKNOWN
  const partial =
    known.length < options.length ||
    known.some((option) => option.kind === "union" && option.partial)
  if (known.length === 1 && !partial) return known[0]!
  return { kind: "union", options: known, ...(partial ? { partial } : {}) }
}

function valueOf(binding: Binding | undefined, depth: number): Value {
  const settled = settle(binding)
  if (!settled || "opaque" in settled) return UNKNOWN
  if ("node" in settled) return evaluate(settled.node, settled.env, depth)
  return member(valueOf(settled.of, depth + 1), settled.key, depth + 1)
}

function evaluate(raw: Node, env: Env, depth = 0): Value {
  if (depth > 60) return UNKNOWN
  const node = unwrap(raw)
  switch (node.type) {
    case "Identifier":
      if (node.name === "undefined")
        return { kind: "literal", value: undefined }
      return valueOf(lookup(env, node.name as string), depth + 1)
    case "Literal":
      return { kind: "literal", value: node.value }
    case "ObjectExpression":
      return {
        kind: "object",
        entries: (node.properties as Node[]).flatMap((property): Entry[] => {
          if (property.type === "SpreadElement")
            return [{ spread: property.argument as Node, env }]
          const key = keyOf(property)
          return key ? [{ key, node: property.value as Node, env }] : []
        }),
      }
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "FunctionDeclaration":
      return { kind: "function", node, env }
    case "ConditionalExpression":
      return union([
        evaluate(node.consequent as Node, env, depth + 1),
        evaluate(node.alternate as Node, env, depth + 1),
      ])
    case "LogicalExpression":
      return node.operator === "&&"
        ? evaluate(node.right as Node, env, depth + 1)
        : union([
            evaluate(node.left as Node, env, depth + 1),
            evaluate(node.right as Node, env, depth + 1),
          ])
    case "MemberExpression": {
      const key = memberKey(node)
      return key === undefined
        ? UNKNOWN
        : member(evaluate(node.object as Node, env, depth + 1), key, depth + 1)
    }
    case "CallExpression": {
      const callee = evaluate(node.callee as Node, env, depth + 1)
      const calls = (value: Value): Value =>
        value.kind === "function"
          ? call(value, node.arguments as Node[], env, depth + 1)
          : value.kind === "union"
            ? union(value.options.map(calls))
            : UNKNOWN
      return calls(callee)
    }
    default:
      return UNKNOWN
  }
}

function memberKey(node: Node): string | undefined {
  const property = node.property as Node
  if (!node.computed) return name(property)
  return property.type === "Literal" && typeof property.value === "string"
    ? property.value
    : undefined
}

/** A member of a value: the last entry of that key, or the member of what it spreads. */
function member(value: Value, key: string, depth: number): Value {
  if (depth > 60) return UNKNOWN
  if (value.kind === "union")
    return union(value.options.map((option) => member(option, key, depth + 1)))
  if (value.kind !== "object") return UNKNOWN
  for (let index = value.entries.length - 1; index >= 0; index--) {
    const entry = value.entries[index]!
    if ("key" in entry) {
      if (entry.key === key) return evaluate(entry.node, entry.env, depth + 1)
    } else {
      const found = member(
        evaluate(entry.spread, entry.env, depth + 1),
        key,
        depth + 1
      )
      if (found.kind !== "unknown") return found
    }
  }
  return UNKNOWN
}

/** The scope a call runs in: its parameters bound to the arguments, its body's declarations. */
function callScope(
  fn: { node: Node; env: Env },
  args: readonly Node[],
  callerEnv: Env,
  /** Also the declarations of the functions nested in it. */
  deep = false
): Env {
  const env: Env = { module: fn.env.module, vars: new Map(), parent: fn.env }
  ;(fn.node.params as Node[]).forEach((param, index) => {
    const arg = args[index]
    bindPattern(
      param,
      arg && arg.type !== "SpreadElement"
        ? { node: arg, env: callerEnv }
        : undefined,
      env
    )
  })
  const body = fn.node.body as Node
  if (body.type === "BlockStatement")
    walk(
      body,
      (statement) => {
        if (
          statement.type === "VariableDeclaration" ||
          statement.type === "FunctionDeclaration"
        )
          bindDeclarations(statement, env)
      },
      !deep
    )
  return env
}

/** What a function returns: its expression body, or the argument of each of its `return`s. */
function returns(fn: Node): Node[] {
  const body = fn.body as Node
  if (body.type !== "BlockStatement") return [body]
  const out: Node[] = []
  walk(
    body,
    (node) => {
      if (node.type === "ReturnStatement" && node.argument)
        out.push(node.argument as Node)
    },
    true
  )
  return out
}

function call(
  fn: { node: Node; env: Env },
  args: readonly Node[],
  callerEnv: Env,
  depth: number
): Value {
  if (calling.has(fn.node)) return UNKNOWN
  calling.add(fn.node)
  try {
    const env = callScope(fn, args, callerEnv)
    return union(returns(fn.node).map((node) => evaluate(node, env, depth + 1)))
  } finally {
    calling.delete(fn.node)
  }
}

// What an attribute is written with -------------------------------------------------------------

/** A typed field an attribute's value is read from: a state's (`state.side`) or a return's. */
type Field = {
  field: string
  module: Module
  returnOf?: { module: Module; fn: string }
}

/**
 * What a part writes on one attribute, over every place it sets it: its presence (`""`), string
 * literals, typed fields whose values a `.d.ts` lists, or a value no key can list (`open`).
 * `varies` is false for a constant.
 */
type Written = {
  /** Only written by a method found by its name (`Collected.methods`). */
  guessed?: boolean
  presence: boolean
  values: string[]
  fields: Field[]
  open: boolean
  varies: boolean
}

const nothing = (): Written => ({
  presence: false,
  values: [],
  fields: [],
  open: false,
  varies: false,
})

const copy = (wrote: Written): Written => ({
  ...wrote,
  values: [...wrote.values],
  fields: [...wrote.fields],
})

function mergeWritten(into: Written, more: Written) {
  into.guessed = !!into.guessed && !!more.guessed
  into.presence ||= more.presence
  into.open ||= more.open
  into.varies ||= more.varies
  for (const value of more.values)
    if (!into.values.includes(value)) into.values.push(value)
  into.fields.push(...more.fields)
}

/** What an expression writes on an attribute. */
function written(
  raw: Node,
  env: Env,
  out = nothing(),
  seen = new Set<Node>(),
  depth = 0
): Written {
  const node = unwrap(raw)
  if (depth > 40 || seen.has(node)) {
    out.open = true
    return out
  }
  seen.add(node)
  const recurse = (next: Node, nextEnv: Env) =>
    written(next, nextEnv, out, seen, depth + 1)
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") {
        if (node.value === "") out.presence = true
        else if (!out.values.includes(node.value)) out.values.push(node.value)
      } else if (node.value !== null) out.open = true
      break
    case "TemplateLiteral":
      if ((node.expressions as Node[]).length === 0) {
        const cooked = ((node.quasis as Node[])[0]!.value as { cooked: string })
          .cooked
        if (cooked === "") out.presence = true
        else if (!out.values.includes(cooked)) out.values.push(cooked)
      } else out.open = true
      break
    case "UnaryExpression":
      if (node.operator !== "void") out.open = true
      break
    case "ConditionalExpression":
      out.varies = true
      recurse(node.consequent as Node, env)
      recurse(node.alternate as Node, env)
      break
    case "LogicalExpression":
      out.varies = true
      if (node.operator !== "&&") recurse(node.left as Node, env)
      recurse(node.right as Node, env)
      break
    case "Identifier": {
      if (node.name === "undefined") break
      out.varies = true
      const binding = settle(lookup(env, node.name as string))
      if (binding && "node" in binding) recurse(binding.node, binding.env)
      else if (binding && "of" in binding) {
        const found = entriesOf(valueOf(binding.of, 0), binding.key)
        for (const entry of found.entries) recurse(entry.node, entry.env)
        if (!found.complete)
          out.fields.push(
            fieldOf(binding.of, binding.key) ?? {
              field: binding.key,
              module: env.module,
            }
          )
      } else out.fields.push({ field: node.name as string, module: env.module })
      break
    }
    case "MemberExpression": {
      out.varies = true
      const key = memberKey(node)
      if (key === undefined) {
        out.open = true
        break
      }
      // What a declared function returns is typed by its declaration (`result.side`, where
      // `result = computePlacement(…)`), more closely than by what its body computes.
      const returned = returnField(node.object as Node, env, key)
      if (returned && fieldValues(returned, [])) {
        out.fields.push(returned)
        break
      }
      const found = entriesOf(evaluate(node.object as Node, env), key)
      for (const entry of found.entries) recurse(entry.node, entry.env)
      if (!found.complete)
        out.fields.push(returned ?? { field: key, module: env.module })
      break
    }
    case "CallExpression": {
      out.varies = true
      const callee = evaluate(node.callee as Node, env)
      if (callee.kind === "function" && !calling.has(callee.node)) {
        calling.add(callee.node)
        try {
          const scope = callScope(callee, node.arguments as Node[], env)
          for (const result of returns(callee.node)) recurse(result, scope)
        } finally {
          calling.delete(callee.node)
        }
      } else out.open = true
      break
    }
    default:
      out.varies = true
      out.open = true
  }
  return out
}

/** The entry of a key in an object value, when it is written there as one expression. */
function entryOf(
  value: Value,
  key: string
): { node: Node; env: Env } | undefined {
  if (value.kind !== "object") return undefined
  for (let index = value.entries.length - 1; index >= 0; index--) {
    const entry = value.entries[index]!
    if ("key" in entry && entry.key === key) return entry
    if ("spread" in entry) {
      const inner = entryOf(evaluate(entry.spread, entry.env), key)
      if (inner) return inner
    }
  }
  return undefined
}

/**
 * The entries of a key in a value, over each option of a union, and whether they are all it can
 * hold: not when an option could not be read or lacks the key (`segment.type`, where `segment` is
 * a segment found at run time or the literal `empty`).
 */
function entriesOf(
  value: Value,
  key: string
): { entries: { node: Node; env: Env }[]; complete: boolean } {
  if (value.kind === "union") {
    const each = value.options.map((option) => entriesOf(option, key))
    return {
      entries: each.flatMap((found) => found.entries),
      complete: !value.partial && each.every((found) => found.complete),
    }
  }
  const entry = entryOf(value, key)
  return { entries: entry ? [entry] : [], complete: !!entry }
}

/** `result.side` where `result` is what a module's function returns: that function's return type. */
function returnField(object: Node, env: Env, key: string): Field | undefined {
  const variable = name(unwrap(object))
  const binding = variable ? settle(lookup(env, variable)) : undefined
  return binding && "node" in binding
    ? callField(binding.node, binding.env, key)
    : undefined
}

function fieldOf(binding: Binding, key: string): Field | undefined {
  const settled = settle(binding)
  return settled && "node" in settled
    ? callField(settled.node, settled.env, key)
    : undefined
}

function callField(raw: Node, env: Env, key: string): Field | undefined {
  const node = unwrap(raw)
  if (node.type !== "CallExpression") return undefined
  const callee = name(unwrap(node.callee as Node))
  if (!callee) return undefined
  const fn = settle(lookup(env, callee))
  if (!fn || !("node" in fn) || fn.node.type !== "FunctionDeclaration")
    return undefined
  return {
    field: key,
    module: fn.env.module,
    returnOf: { module: fn.env.module, fn: callee },
  }
}

// Collecting a part's attributes ------------------------------------------------------------------

type Collected = {
  attributes: Map<string, Written>
  /** Functions already read for this part. */
  seen: Set<Node>
  /** Modules the part's code was read in, whose declarations type its fields. */
  modules: Set<Module>
  /** What could not be read, as code. */
  unread: string[]
  /** Methods by name, for a call on an object built at run time. */
  methods: (method: string) => { node: Node; env: Env }[]
  /** Above zero while a method found by its name is read. */
  guessing: number
  /** The component's folder, whose modules define its api's methods. */
  folder?: string
}

function note(collected: Collected, attribute: string, more: Written) {
  if (attribute === "data-slot") return
  more.guessed = collected.guessing > 0
  const known = collected.attributes.get(attribute)
  if (known) mergeWritten(known, more)
  else collected.attributes.set(attribute, more)
}

const source = (node: Node, env: Env) =>
  env.module.text.slice(node.start, node.end).replace(/\s+/g, " ")

/** The `data-*` attributes an expression of an `attrs` function returns. */
function collect(raw: Node, env: Env, collected: Collected, depth = 0) {
  if (depth > 40) return
  const node = unwrap(raw)
  collected.modules.add(env.module)
  switch (node.type) {
    case "ObjectExpression":
      for (const property of node.properties as Node[]) {
        if (property.type === "SpreadElement") {
          collect(property.argument as Node, env, collected, depth + 1)
          continue
        }
        const key = keyOf(property)
        if (key?.startsWith("data-"))
          note(collected, key, written(property.value as Node, env))
      }
      break
    case "ConditionalExpression":
      collect(node.consequent as Node, env, collected, depth + 1)
      collect(node.alternate as Node, env, collected, depth + 1)
      break
    case "LogicalExpression":
      if (node.operator !== "&&")
        collect(node.left as Node, env, collected, depth + 1)
      collect(node.right as Node, env, collected, depth + 1)
      break
    case "CallExpression": {
      const callee = evaluate(node.callee as Node, env)
      const fns = functions(callee)
      const args = node.arguments as Node[]
      if (fns.length === 0) {
        const target = unwrap(node.callee as Node)
        const method =
          target.type === "MemberExpression" ? memberKey(target) : undefined
        const found = method ? collected.methods(method) : []
        if (found.length === 0) {
          collected.unread.push(source(node, env))
          break
        }
        collected.guessing++
        for (const fn of found)
          collectReturns(fn, args, env, collected, depth + 1)
        collected.guessing--
        break
      }
      for (const fn of fns) collectReturns(fn, args, env, collected, depth + 1)
      break
    }
    case "Identifier": {
      // Read through the expression it names, so a call in it is read as a call is.
      const binding = settle(lookup(env, node.name as string))
      if (binding && "node" in binding) {
        collect(binding.node, binding.env, collected, depth + 1)
        break
      }
      const value = binding ? valueOf(binding, 0) : UNKNOWN
      if (value.kind === "unknown") collected.unread.push(source(node, env))
      else collectValue(value, collected, depth + 1)
      break
    }
    case "MemberExpression": {
      const value = evaluate(node, env)
      if (value.kind === "unknown") collected.unread.push(source(node, env))
      else collectValue(value, collected, depth + 1)
      break
    }
    case "Literal":
      break
    default:
      collected.unread.push(source(node, env))
  }
}

function functions(value: Value): { node: Node; env: Env }[] {
  if (value.kind === "function") return [value]
  if (value.kind === "union") return value.options.flatMap(functions)
  return []
}

function collectReturns(
  fn: { node: Node; env: Env },
  args: readonly Node[],
  callerEnv: Env,
  collected: Collected,
  depth: number
) {
  if (collected.seen.has(fn.node)) return
  collected.seen.add(fn.node)
  const env = callScope(fn, args, callerEnv)
  for (const result of returns(fn.node)) collect(result, env, collected, depth)
}

function collectValue(value: Value, collected: Collected, depth: number) {
  if (value.kind === "union")
    for (const option of value.options) collectValue(option, collected, depth)
  if (value.kind !== "object") return
  for (const entry of value.entries) {
    if ("spread" in entry) collect(entry.spread, entry.env, collected, depth)
    else if (entry.key.startsWith("data-"))
      note(collected, entry.key, written(entry.node, entry.env))
  }
}

/**
 * What a function writes on the element it is handed as its `index`th parameter, and in the
 * functions it hands that element to, each read once: `el.setAttribute("data-x", …)` and
 * `el.toggleAttribute("data-x", …)`.
 */
function imperative(
  fn: { node: Node; env: Env },
  index: number,
  collected: Collected
) {
  const param = (fn.node.params as Node[])[index]
  const element = param && name(param)
  if (!element || collected.seen.has(fn.node)) return
  collected.seen.add(fn.node)
  writesOn(
    fn.node.body as Node,
    element,
    callScope(fn, [], fn.env, true),
    collected
  )
}

/** What code writes on the element a name holds, and in the functions it hands it to. */
function writesOn(body: Node, element: string, env: Env, collected: Collected) {
  collected.modules.add(env.module)
  walk(body, (node) => {
    if (node.type !== "CallExpression") return
    const callee = unwrap(node.callee as Node)
    const args = node.arguments as Node[]
    const method =
      callee.type === "MemberExpression" ? memberKey(callee) : undefined
    const attribute = args[0]?.type === "Literal" ? args[0].value : undefined
    if (
      callee.type === "MemberExpression" &&
      name(unwrap(callee.object as Node)) === element &&
      typeof attribute === "string" &&
      attribute.startsWith("data-")
    ) {
      // Set while something holds, and taken off after: never a constant.
      if (method === "setAttribute" && args[1])
        note(collected, attribute, { ...written(args[1], env), varies: true })
      else if (method === "toggleAttribute")
        note(collected, attribute, {
          ...nothing(),
          presence: true,
          varies: true,
        })
      return
    }
    const at = args.findIndex((arg) => name(unwrap(arg)) === element)
    if (at < 0) return
    const targets = functions(evaluate(callee, env))
    // A method of the component's api (`api.internal.bindRoot(el)`), which the api builds at run
    // time: the methods of that name the component's own modules define.
    if (targets.length === 0 && method && internal(callee))
      targets.push(
        ...collected
          .methods(method)
          .filter(
            (target) =>
              path.dirname(target.env.module.file) === collected.folder
          )
      )
    // A function declared beside it in a closure this reads without (`startSwipe(el, …)` in the
    // toast api's body): the function of that name in the same module.
    const called = name(callee)
    if (targets.length === 0 && called)
      targets.push(
        ...collected
          .methods(called)
          .filter((target) => target.env.module === env.module)
      )
    for (const target of targets) imperative(target, at, collected)
  })
}

/**
 * What a component's modules write on a part's element they look up by its slot
 * (`const el = element("content")`, then `trackModality(el, …)`, which writes `data-modality`), by
 * slot: the kernel's `element(slot)` hands back that part's element.
 */
function slotElementWrites(
  module: Module,
  collectedFor: (slot: string) => Collected | undefined
) {
  const slotOf = (raw: Node | undefined) => {
    const node = raw && unwrap(raw)
    if (node?.type !== "CallExpression") return undefined
    const callee = unwrap(node.callee as Node)
    const called =
      callee.type === "MemberExpression" ? memberKey(callee) : name(callee)
    const [slot] = node.arguments as Node[]
    return called === "element" &&
      slot?.type === "Literal" &&
      typeof slot.value === "string"
      ? slot.value
      : undefined
  }
  const visit = (node: unknown, inside: Node | undefined) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inside)
      return
    }
    if (!node || typeof node !== "object") return
    const current = node as Node
    const slot =
      current.type === "VariableDeclarator"
        ? slotOf(current.init as Node)
        : undefined
    const variable = name(current.id)
    const collected = slot ? collectedFor(slot) : undefined
    if (collected && variable && inside)
      writesOn(
        inside.body as Node,
        variable,
        callScope({ node: inside, env: module.env }, [], module.env, true),
        collected
      )
    const next = isFunction(current) ? current : inside
    for (const [key, value] of Object.entries(current))
      if (key !== "parent" && value && typeof value === "object")
        visit(value, next)
  }
  visit(module.program, undefined)
}

/** Whether a callee is a member of an api's `internal` (`part.api.internal.join`). */
function internal(callee: Node): boolean {
  for (let node = unwrap(callee); node.type === "MemberExpression";) {
    const object = unwrap(node.object as Node)
    if (object.type === "MemberExpression" && memberKey(object) === "internal")
      return true
    node = object
  }
  return false
}

const blank = (module: Module): Collected => ({
  attributes: new Map(),
  seen: new Set(),
  modules: new Set([module]),
  unread: [],
  methods: () => [],
  guessing: 0,
})

// The popup layer -------------------------------------------------------------------------------

/**
 * A popup's element is bound by the popup layer (`createPopupLayer` in
 * `foundation/popups/popup.js`) through its api, which nothing in a part's code names: the layer
 * keeps the element it is handed and, as the popup opens and closes, animates it and its backdrop
 * in and out (`animateIn(el)`, `animateOut(target)`) and writes whether it is open
 * (`writeOpen(part, open)`). A part is that element when its `connect` is `registerPopupElement`,
 * as `popupContent`'s is, and the component's `backdrop` part is its backdrop. What the layer writes
 * is read from `createPopupLayer`, following each element it hands a function, as a part's `bind`
 * is read.
 */
function popupLayer(core: string): { connect: Node; collected: Collected } {
  const elements = load(path.join(core, "foundation/popups/popup-elements.js"))
  const connect = settle(elements.env.vars.get("registerPopupElement"))
  const module = load(path.join(core, "foundation/popups/popup.js"))
  const layer = settle(module.env.vars.get("createPopupLayer"))
  if (!connect || !("node" in connect) || !layer || !("node" in layer))
    throw new Error("popup.js no longer declares createPopupLayer()")
  const collected = blank(module)
  const env = callScope(layer, [], layer.env, true)
  walk(layer.node.body, (node) => {
    if (node.type !== "CallExpression") return
    ;(node.arguments as Node[]).forEach((arg, index) => {
      if (unwrap(arg).type !== "Identifier") return
      for (const target of functions(evaluate(node.callee as Node, env)))
        imperative(target, index, collected)
    })
  })
  if (!collected.attributes.has("data-starting-style"))
    throw new Error("createPopupLayer() no longer animates its popup in")
  return { connect: connect.node, collected }
}

// The positioner ----------------------------------------------------------------------------------

/**
 * `position(anchor, el, options)` (`foundation/platform/position.js`) places a popup beside its
 * anchor and writes `data-side` and `data-align` on it and on its arrow. Nothing in a part's code
 * names it: a popup's `bind` hands its element to a placement its api builds at run time. A part
 * whose props take `side` and `align` is one it places (`popupContent`'s), and the component's
 * `arrow` part is that popup's arrow (`element("arrow")`). The attributes and their values are read
 * from `position` itself: what it writes through the writer of `el`, and through the arrow's.
 */
function positioner(core: string): { popup: Collected; arrow: Collected } {
  const module = load(path.join(core, "foundation/platform/position.js"))
  const fn = settle(module.env.vars.get("position"))
  if (!fn || !("node" in fn))
    throw new Error("position.js no longer declares position()")
  const element = name((fn.node.params as Node[])[1])
  const env = callScope(fn, [], fn.env, true)
  const popup = blank(module)
  const arrow = blank(module)
  // `const popup = createWriter(el)`: the writer of the popup; any other writer is the arrow's.
  const writers = new Set<string>()
  walk(fn.node.body, (node) => {
    if (
      node.type === "VariableDeclarator" &&
      node.init &&
      unwrap(node.init as Node).type === "CallExpression"
    ) {
      const init = unwrap(node.init as Node)
      const [first] = init.arguments as Node[]
      if (
        name(unwrap(init.callee as Node)) === "createWriter" &&
        first &&
        name(first) === element
      )
        writers.add(name(node.id)!)
    }
  })
  walk(fn.node.body, (node) => {
    if (node.type !== "CallExpression") return
    const callee = unwrap(node.callee as Node)
    const [attribute, value] = node.arguments as Node[]
    if (
      callee.type !== "MemberExpression" ||
      memberKey(callee) !== "attribute" ||
      attribute?.type !== "Literal" ||
      typeof attribute.value !== "string" ||
      !value
    )
      return
    const into = writers.has(name(unwrap(callee.object as Node)) ?? "")
      ? popup
      : arrow
    note(into, attribute.value, written(value, env))
  })
  if (!popup.attributes.has("data-side"))
    throw new Error("position() no longer writes data-side on the popup")
  return { popup, arrow }
}

// Types and descriptions --------------------------------------------------------------------------

type Declarations = {
  program: Node
  text: string
  comments: Module["comments"]
  file: string
}
const declarationCache = new Map<string, Declarations | undefined>()

function declarations(file: string): Declarations | undefined {
  if (declarationCache.has(file)) return declarationCache.get(file)
  let out: Declarations | undefined
  if (existsSync(file)) {
    const text = readFileSync(file, "utf8")
    const { program, comments } = parseSync(path.basename(file), text)
    out = {
      program: program as unknown as Node,
      text,
      comments: comments as Module["comments"],
      file,
    }
  }
  declarationCache.set(file, out)
  return out
}

const dtsOf = (file: string) => file.replace(/\.js$/, ".d.ts")

/** The string literals a type lists, `null` and `undefined` aside; none for any other type. */
function literalUnion(
  raw: Node | undefined,
  file: Declarations,
  depth = 0
): string[] | undefined {
  if (!raw || depth > 10) return undefined
  const node =
    raw.type === "TSTypeAnnotation" ? (raw.typeAnnotation as Node) : raw
  switch (node.type) {
    case "TSParenthesizedType":
      return literalUnion(node.typeAnnotation as Node, file, depth + 1)
    case "TSLiteralType": {
      const value = (node.literal as Node).value
      return typeof value === "string" ? [value] : undefined
    }
    case "TSNullKeyword":
    case "TSUndefinedKeyword":
      return []
    case "TSUnionType": {
      const out: string[] = []
      for (const option of node.types as Node[]) {
        const values = literalUnion(option, file, depth + 1)
        if (!values) return undefined
        out.push(...values.filter((value) => !out.includes(value)))
      }
      return out
    }
    case "TSTypeReference": {
      const reference = name(node.typeName)
      if (!reference || node.typeArguments) return undefined
      const alias = typeAlias(file, reference)
      return alias ? literalUnion(alias.node, alias.file, depth + 1) : undefined
    }
    default:
      return undefined
  }
}

/** A type alias by name, in a declaration file or the one it imports it from. */
function typeAlias(
  file: Declarations,
  alias: string,
  depth = 0
): { node: Node; file: Declarations } | undefined {
  if (depth > 10) return undefined
  for (const statement of file.program.body as Node[]) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement.declaration as Node | null)
        : statement
    if (
      declaration?.type === "TSTypeAliasDeclaration" &&
      name(declaration.id) === alias
    )
      return { node: declaration.typeAnnotation as Node, file }
    if (statement.type === "ImportDeclaration")
      for (const specifier of statement.specifiers as Node[])
        if (name(specifier.local) === alias) {
          const from = declarations(
            dtsOf(
              path.resolve(
                path.dirname(file.file),
                (statement.source as Node).value as string
              )
            )
          )
          const imported = name(specifier.imported) ?? alias
          return from ? typeAlias(from, imported, depth + 1) : undefined
        }
  }
  return undefined
}

type Property = { owner: string; field: string; type: Node; doc: string }
const propertyCache = new Map<Declarations, Property[]>()

/** Each property signature of a declaration file, with the type alias it sits in and its JSDoc. */
function properties(file: Declarations): Property[] {
  const cached = propertyCache.get(file)
  if (cached) return cached
  const out: Property[] = []
  propertyCache.set(file, out)
  for (const statement of file.program.body as Node[]) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement.declaration as Node | null)
        : statement
    if (!declaration) continue
    const owner =
      declaration.type === "TSTypeAliasDeclaration" ||
      declaration.type === "TSInterfaceDeclaration"
        ? name(declaration.id)!
        : ""
    walk(declaration, (node) => {
      if (node.type !== "TSPropertySignature" || node.computed) return
      const field = keyOf(node)
      if (field && node.typeAnnotation)
        out.push({
          owner,
          field,
          type: node.typeAnnotation as Node,
          doc: jsdoc(file, node.start),
        })
    })
  }
  return out
}

/** The text of the JSDoc block right before a position. */
function jsdoc(file: Declarations, start: number): string {
  const comment = file.comments.find(
    (candidate) =>
      candidate.type === "Block" &&
      candidate.value.startsWith("*") &&
      candidate.end <= start &&
      file.text.slice(candidate.end, start).trim() === ""
  )
  return comment
    ? comment.value
        .split("\n")
        .map((line) => line.replace(/^\s*\*+\s?/, "").trim())
        .filter((line) => line && !line.startsWith("@"))
        .join(" ")
        .trim()
    : ""
}

/**
 * The string literals a function's declared return type lists for a property, over each member of
 * a union it returns (`segmentsOf` returns a literal segment or an editable one).
 */
function returnProperty(file: Declarations, fn: string, field: string) {
  for (const statement of file.program.body as Node[]) {
    if (statement.type !== "TSDeclareFunction" || name(statement.id) !== fn)
      continue
    const out: string[] = []
    let typed = false
    walk(statement.returnType, (node) => {
      if (node.type !== "TSPropertySignature" || keyOf(node) !== field) return
      const values = literalUnion(node.typeAnnotation as Node, file)
      if (!values) return
      typed = true
      for (const value of values) if (!out.includes(value)) out.push(value)
    })
    return typed && out.length > 0 ? out : undefined
  }
  return undefined
}

/**
 * The values a typed field holds: a return type's property, or the property of that name in the
 * component's declarations and those of the modules its part was read in, a state type's first
 * (`PopoverContentState`). The first union of string literals wins.
 */
function fieldValues(
  field: Field,
  files: readonly Declarations[]
): string[] | undefined {
  if (field.returnOf) {
    const file = declarations(dtsOf(field.returnOf.module.file))
    const values = file && returnProperty(file, field.returnOf.fn, field.field)
    if (values) return values
  }
  const beside = declarations(dtsOf(field.module.file))
  return typedProperty(field.field, [...files, ...(beside ? [beside] : [])])
}

/**
 * The string literals the properties of a name list, a state type's first: those of the first
 * file that types one, all of its properties of that name together (`date-input-model.d.ts` types
 * a literal segment's `type: "literal"` and an editable one's `type: "month" | …`).
 */
function typedProperty(
  field: string,
  files: readonly Declarations[]
): string[] | undefined {
  for (const states of [true, false])
    for (const file of files) {
      const out: string[] = []
      for (const property of properties(file)) {
        if (
          property.field !== field ||
          property.owner.endsWith("State") !== states
        )
          continue
        for (const value of literalUnion(property.type, file) ?? [])
          if (!out.includes(value)) out.push(value)
      }
      if (out.length > 0) return out
    }
  return undefined
}

/** `nested-open` → `nested open`. */
const words = (value: string) => value.replace(/-/g, " ")

/** `inline-end` → `inlineEnd`. */
const camel = (value: string) =>
  value.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())

/** `radio-group` → `RadioGroup`. */
const pascal = (value: string) =>
  camel(value).replace(/^\w/, (letter) => letter.toUpperCase())

/** A description's sentences. */
const sentences = (text: string) =>
  text
    .split(/(?<=\.)\s+(?=[A-Z`"])/)
    .map((part) => part.trim())
    .filter(Boolean)

const sentence = (text: string) => {
  const first = sentences(text)[0] ?? text
  return first.endsWith(".") ? first : `${first}.`
}

const named = (text: string) =>
  [...text.matchAll(/`(data-[a-z0-9-]+)`/g)].map((match) => match[1]!)

/**
 * What the package's declarations say of an attribute, by attribute: the JSDoc of a property that
 * names it (`destructive`, "Styles the item as dangerous, like Delete. Sets `data-destructive`."),
 * by property, and the sentence of a declared function's JSDoc that names it and no other
 * (`animateIn`, "Starts an element's enter animation: `data-starting-style` for its first frame, so
 * CSS transitions from it.").
 */
function attributeDocs(files: readonly Declarations[]) {
  const byProperty = new Map<string, string>()
  const byWriter = new Map<string, string>()
  for (const file of files) {
    for (const property of properties(file))
      for (const attribute of named(property.doc))
        byProperty.set(
          `${property.field} ${attribute}`,
          byProperty.get(`${property.field} ${attribute}`) ?? property.doc
        )
    for (const statement of file.program.body as Node[]) {
      if (statement.type !== "TSDeclareFunction") continue
      for (const line of sentences(jsdoc(file, statement.start))) {
        const attributes = new Set(named(line))
        const [only] = attributes
        if (attributes.size === 1 && !byWriter.has(only!))
          byWriter.set(only!, line.endsWith(".") ? line : `${line}.`)
      }
    }
  }
  return { byProperty, byWriter }
}

type Docs = ReturnType<typeof attributeDocs>

/**
 * A state's description, from the package's own comments where there is one: the JSDoc of the
 * field of its name in the part's state type, then the component's (`PopoverContentState.open`,
 * "Whether the popover is open.", as "Present when the popover is open."), then what
 * `attributeDocs` finds. Otherwise one written from the attribute.
 */
function describe(
  attribute: string,
  state: string,
  values: readonly string[],
  open: boolean,
  context: Context
): string {
  const { component, part, own, docs } = context
  const owners = [
    `${pascal(component)}${pascal(part)}State`,
    `${pascal(component)}State`,
  ]
  const listed = values.map((value) => `\`${value}\``).join(", ")
  const withValues = (text: string) =>
    values.length > 0 ? `${text} One of ${listed}.` : text
  const documented = owners
    .flatMap((owner) =>
      own
        .flatMap(properties)
        .filter(
          (property) => property.owner === owner && property.field === state
        )
    )
    .find((property) => property.doc)?.doc
  if (documented) {
    if (values.length === 0 && !open && documented.startsWith("Whether "))
      return `Present when ${sentence(documented.slice("Whether ".length))}`
    return withValues(sentence(documented))
  }
  const found =
    docs.byProperty.get(`${state} ${attribute}`) ?? docs.byWriter.get(attribute)
  if (found) return withValues(found)
  const subject =
    part === "root"
      ? `the ${words(component)}`
      : `the ${words(component)} ${words(part)}`
  const plain = words(attribute.replace(/^data-/, ""))
  if (values.length > 0) return `The ${plain} of ${subject}: one of ${listed}.`
  if (open)
    return `The ${plain} of ${subject}, a value no key lists: present whenever it is set.`
  return `Present when ${subject} is ${plain}.`
}

type Context = {
  component: string
  part: string
  own: readonly Declarations[]
  docs: Docs
}

// The vocabulary ----------------------------------------------------------------------------------

/** A state from what a part writes on an attribute, or why it is left out. */
function stateOf(
  attribute: string,
  wrote: Written,
  context: Context,
  beside: readonly Declarations[]
): State | string {
  const known = UI_SDK_NOT_STATES.get(attribute)
  if (known) return known
  let open = wrote.open
  const values = [...wrote.values]
  // A method found by its name may be another component's: what it writes is this one's only
  // when this component's own declarations type it.
  const files = wrote.guessed ? context.own : [...context.own, ...beside]
  for (const field of wrote.fields) {
    // A field no type lists, or the attribute typed where its object is (`radioGroupAttrs`
    // declares `"data-orientation": "horizontal" | "vertical" | undefined`).
    const typed = wrote.guessed
      ? (typedProperty(field.field, files) ?? typedProperty(attribute, files))
      : (fieldValues(field, files) ?? typedProperty(attribute, files))
    if (!typed) open = true
    else
      for (const value of typed) if (!values.includes(value)) values.push(value)
  }
  if (!wrote.varies && !open && values.length + (wrote.presence ? 1 : 0) <= 1)
    return "written as one constant, a marker every such element carries"
  if (wrote.guessed && open)
    return "written only by a method found by its name, with a value this component's declarations do not type"
  if (!open && values.length === 0 && !wrote.presence)
    return "never written with a value"
  const listed = open ? [] : values
  const stateName = camel(attribute.replace(/^data-/, ""))
  return {
    name: stateName,
    attribute,
    doc: describe(attribute, stateName, listed, open, context),
    values: listed,
    ...(listed.length > 0 && wrote.presence ? { presence: true } : {}),
  }
}

/** The expression a binding holds, through the names it is passed on by (`var popover = popoverPrimitive`). */
function expressionOf(binding: Binding | undefined): Node | undefined {
  let current = settle(binding)
  for (let hops = 0; current && "node" in current && hops < 20; hops++) {
    const node = unwrap(current.node)
    if (node.type !== "Identifier") return node
    current = settle(lookup(current.env, node.name as string))
  }
  return undefined
}

/** A package's directory and version. */
function installed(pkg: string) {
  const file = require.resolve(`${pkg}/package.json`)
  const directory = path.dirname(file)
  const version = JSON.parse(readFileSync(file, "utf8")).version as string
  return { directory, version }
}

/** A primitive: the object `definePrimitive` is handed, by its export. */
type Primitive = {
  name: string
  folder: string
  slots: { key: string; definition: Value }[]
  module: Module
  /** The `definePrimitive(…)` call. */
  call: Node
}

/**
 * The `definePrimitive(…)` calls of a module, each with the function it sits in, if any: Dialog and
 * Alert Dialog are made by one `defineDialog(name, …)`, which calls it with the name it is handed.
 */
function definePrimitiveCalls(module: Module): { call: Node; inside?: Node }[] {
  const out: { call: Node; inside?: Node }[] = []
  const visit = (node: unknown, inside: Node | undefined) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inside)
      return
    }
    if (!node || typeof node !== "object") return
    const current = node as Node
    if (
      current.type === "CallExpression" &&
      name(unwrap(current.callee as Node)) === "definePrimitive"
    )
      out.push({ call: current, inside })
    const next = isFunction(current) ? current : inside
    for (const [key, value] of Object.entries(current))
      if (key !== "parent" && value && typeof value === "object")
        visit(value, next)
  }
  visit(module.program, undefined)
  return out
}

/** A primitive from the object a `definePrimitive` call is handed, read in `env`. */
function primitiveOf(
  definition: Node,
  env: Env,
  module: Module,
  folder: string,
  site: Node
): Primitive {
  const value = evaluate(definition, env)
  const primitiveName = member(value, "name", 0)
  const slots = member(value, "slots", 0)
  if (
    primitiveName.kind !== "literal" ||
    typeof primitiveName.value !== "string"
  )
    throw new Error(
      `${path.basename(module.file)}: a definePrimitive call whose name is not a string`
    )
  if (slots.kind !== "function")
    throw new Error(
      `${path.basename(module.file)}: ${primitiveName.value}'s slots are not a function`
    )
  // `slots: (slot) => …`: `slot` is the identity, so `slot(definition)` is the definition.
  const identity: Node = {
    type: "ArrowFunctionExpression",
    start: 0,
    end: 0,
    params: [{ type: "Identifier", name: "definition", start: 0, end: 0 }],
    body: { type: "Identifier", name: "definition", start: 0, end: 0 },
  }
  const scope = callScope(slots, [], slots.env)
  const param = (slots.node.params as Node[])[0]
  if (param && name(param))
    scope.vars.set(name(param)!, { node: identity, env: slots.env })
  const result = union(
    returns(slots.node).map((returned) => evaluate(returned, scope))
  )
  return {
    name: primitiveName.value,
    folder,
    slots: entries(result),
    module,
    call: site,
  }
}

/** An object value's keys and values, spreads followed. */
function entries(value: Value): { key: string; definition: Value }[] {
  if (value.kind === "union") return value.options.flatMap(entries)
  if (value.kind !== "object") return []
  return value.entries.flatMap((entry) =>
    "key" in entry
      ? [{ key: entry.key, definition: evaluate(entry.node, entry.env) }]
      : entries(evaluate(entry.spread, entry.env))
  )
}

/**
 * Every method of the modules a set of modules reaches through their imports, by name: an object's
 * (`triggerAttrs(state, …) { … }`) and a function declared in another (`function bindRoot(el)`,
 * handed out as `{ bindRoot }`). The slots' own functions (`exclude`) are not among them: a call of
 * `roving.bind(el, part)` is no slot's `bind`.
 */
function methodIndex(roots: readonly Module[], exclude: ReadonlySet<Node>) {
  const reached = new Set<Module>()
  const visit = (module: Module) => {
    if (reached.has(module)) return
    reached.add(module)
    for (const statement of module.program.body as Node[]) {
      if (
        (statement.type === "ImportDeclaration" ||
          statement.type === "ExportNamedDeclaration" ||
          statement.type === "ExportAllDeclaration") &&
        statement.source
      ) {
        const specifier = (statement.source as Node).value as string
        if (!specifier.startsWith(".")) continue
        const file = path.resolve(path.dirname(module.file), specifier)
        if (existsSync(file)) visit(load(file))
      }
    }
  }
  for (const root of roots) visit(root)
  const index = new Map<string, { node: Node; env: Env }[]>()
  for (const module of reached)
    walk(module.program, (node) => {
      const [key, value] =
        node.type === "Property"
          ? [keyOf(node), node.value as Node]
          : node.type === "FunctionDeclaration"
            ? [name(node.id), node]
            : [undefined, undefined]
      if (key && isFunction(value) && !exclude.has(value!))
        index.set(key, [
          ...(index.get(key) ?? []),
          { node: value!, env: module.env },
        ])
    })
  return (method: string) => index.get(method) ?? []
}

/** What ui-sdk's renderer hands a primitive to `use`: `menuCheckable` adds Menu's checkable items. */
function features(core: string, primitives: ReadonlyMap<string, Primitive>) {
  const renderer = load(path.join(core, "renderer.js"))
  const out: {
    primitive: string
    slots: { key: string; definition: Value }[]
  }[] = []
  for (const [exported, binding] of renderer.exported) {
    const value = valueOf(binding(), 0)
    const slots = member(value, "slots", 0)
    if (slots.kind !== "object") continue
    // `menuCheckable` belongs to `menu`, `comboboxChips` to `combobox`: the longest export that
    // starts it, at a word boundary.
    const owner = [...primitives.keys()]
      .filter(
        (candidate) =>
          exported.startsWith(candidate) &&
          /^[A-Z]/.test(exported.slice(candidate.length))
      )
      .sort((a, b) => b.length - a.length)[0]
    if (!owner)
      throw new Error(
        `renderer.js exports ${exported}, of no primitive this reads`
      )
    out.push({ primitive: owner, slots: entries(slots) })
  }
  return out
}

/** Code of ui-sdk the generator could not read, by component and part. */
export type Unread = { component: string; part: string; code: string }[]
/** Attributes a part writes that the vocabulary leaves out, each with why. */
export type LeftOut = {
  component: string
  part: string
  attribute: string
  reason: string
}[]

/** What another reader found a part writes, as the part's own. */
function adopt(collected: Collected, from: Collected) {
  for (const [attribute, wrote] of from.attributes)
    note(collected, attribute, copy(wrote))
  for (const module of from.modules) collected.modules.add(module)
}

/**
 * The ui-sdk vocabulary, with the installed version of `@ui-sdk/core`, the parts read (each
 * component's slots, by `data-slot` name), what is left out and what could not be read.
 */
export function uiSdk(): {
  vocabulary: Vocabulary
  version: string
  parts: Map<string, string[]>
  unread: Unread
  leftOut: LeftOut
} {
  const { directory, version } = installed("@ui-sdk/core")
  const core = path.join(directory, "dist")
  const components = path.join(core, "components")
  // Primitives by export name (`switchPrimitive`), each from its module.
  const byExport = new Map<string, Primitive>()
  const all: Primitive[] = []
  const loaded: { module: Module; folder: string }[] = []
  for (const folder of readdirSync(components).sort())
    for (const entry of readdirSync(path.join(components, folder)).sort())
      if (entry.endsWith(".js"))
        loaded.push({
          module: load(path.join(components, folder, entry)),
          folder,
        })
  // A call at the top of a module makes a primitive; one inside a function makes one at each call of
  // that function.
  const factories = new Map<Node, Node>()
  for (const { module, folder } of loaded)
    for (const { call: site, inside } of definePrimitiveCalls(module)) {
      const definition = (site.arguments as Node[])[0]!
      if (inside) factories.set(inside, definition)
      else all.push(primitiveOf(definition, module.env, module, folder, site))
    }
  for (const { module, folder } of loaded)
    walk(module.program, (node) => {
      if (node.type !== "CallExpression") return
      for (const fn of functions(evaluate(node.callee as Node, module.env))) {
        const definition = factories.get(fn.node)
        if (!definition) continue
        const scope = callScope(fn, node.arguments as Node[], module.env)
        all.push(primitiveOf(definition, scope, module, folder, node))
      }
    })
  for (const { module } of loaded)
    for (const [exported, binding] of module.exported) {
      const target = expressionOf(binding())
      const primitive = all.find((candidate) => candidate.call === target)
      if (primitive) byExport.set(exported, primitive)
    }
  if (all.length === 0)
    throw new Error(
      "@ui-sdk/core has no definePrimitive calls under dist/components"
    )
  const placed = positioner(core)
  const layer = popupLayer(core)
  const extra = features(core, byExport)

  const vocabulary: Vocabulary = new Map()
  const unread: Unread = []
  const leftOut: LeftOut = []
  // Parts by component, each collected over every definition of that part.
  const byName = new Map<
    string,
    {
      folders: Set<string>
      parts: Map<string, Collected>
      positioned: boolean
      layered: boolean
    }
  >()
  const definitions = [
    ...all.map((primitive) => primitive.slots),
    ...extra.map((feature) => feature.slots),
  ].flat()
  const slotFunctions = new Set(
    definitions.flatMap(({ definition }) =>
      ["attrs", "bind"].flatMap((key) =>
        functions(member(definition, key, 0)).map((fn) => fn.node)
      )
    )
  )
  const methods = methodIndex(
    all.map((primitive) => primitive.module),
    slotFunctions
  )
  const collectedFor = (component: string, folder: string, part: string) => {
    const entry =
      byName.get(component) ??
      byName
        .set(component, {
          folders: new Set(),
          parts: new Map(),
          positioned: false,
          layered: false,
        })
        .get(component)!
    entry.folders.add(folder)
    const known = entry.parts.get(part)
    if (known) return { collected: known, entry }
    const collected: Collected = {
      attributes: new Map(),
      seen: new Set(),
      modules: new Set(),
      unread: [],
      methods,
      guessing: 0,
      folder: path.join(components, folder),
    }
    entry.parts.set(part, collected)
    return { collected, entry }
  }
  const read = (
    component: string,
    folder: string,
    key: string,
    definition: Value
  ) => {
    const { collected, entry } = collectedFor(component, folder, key)
    // `attrs`, and the attributes `live(read)` writes on the element as they change.
    const attrs = [
      ...functions(member(definition, "attrs", 0)),
      ...functions(member(member(definition, "live", 0), "read", 0)),
    ]
    for (const fn of attrs) collectReturns(fn, [], fn.env, collected, 0)
    for (const fn of functions(member(definition, "bind", 0)))
      imperative(fn, 0, collected)
    const props = member(definition, "props", 0)
    if (entryOf(props, "side") && entryOf(props, "align")) {
      entry.positioned = true
      adopt(collected, placed.popup)
    }
    const connect = functions(member(definition, "connect", 0))
    if (connect.some((fn) => fn.node === layer.connect)) {
      entry.layered = true
      adopt(collected, layer.collected)
    }
  }
  for (const primitive of all)
    for (const { key, definition } of primitive.slots)
      read(primitive.name, primitive.folder, key, definition)
  for (const feature of extra) {
    const primitive = byExport.get(feature.primitive)!
    for (const { key, definition } of feature.slots)
      read(primitive.name, primitive.folder, key, definition)
  }
  for (const { module, folder } of loaded) {
    const owners = [...byName].filter(([, entry]) => entry.folders.has(folder))
    slotElementWrites(module, (slot) => {
      const owner = owners.find(([, entry]) => entry.parts.has(slot))
      return owner?.[1].parts.get(slot)
    })
  }

  for (const [component, { folders, parts, positioned, layered }] of [
    ...byName,
  ].sort(([a], [b]) => a.localeCompare(b))) {
    const own = [...folders].flatMap((folder) =>
      readdirSync(path.join(components, folder))
        .filter((entry) => entry.endsWith(".d.ts"))
        .sort()
        .flatMap((entry) => {
          const file = declarations(path.join(components, folder, entry))
          return file ? [file] : []
        })
    )
    const byPart = new Map<string, State[]>()
    for (const [part, collected] of parts) {
      if (positioned && part === "arrow") adopt(collected, placed.arrow)
      if (layered && part === "backdrop") adopt(collected, layer.collected)
      const beside = [...collected.modules].flatMap((module) => {
        const file = declarations(dtsOf(module.file))
        return file ? [file] : []
      })
      const context = {
        component,
        part,
        own,
        docs: attributeDocs([...own, ...beside]),
      }
      const states: State[] = []
      for (const [attribute, wrote] of [...collected.attributes].sort(
        ([a], [b]) => a.localeCompare(b)
      )) {
        const state = stateOf(attribute, wrote, context, beside)
        if (typeof state === "string")
          leftOut.push({
            component: pascal(component),
            part: pascal(part),
            attribute,
            reason: state,
          })
        else states.push(state)
      }
      for (const code of collected.unread)
        unread.push({ component: pascal(component), part: pascal(part), code })
      if (states.length > 0)
        byPart.set(
          pascal(part),
          states.sort((a, b) => a.name.localeCompare(b.name))
        )
    }
    if (byPart.size > 0) vocabulary.set(pascal(component), byPart)
  }
  const parts = new Map(
    [...byName]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([component, entry]) => [component, [...entry.parts.keys()]])
  )
  return { vocabulary, version, parts, unread, leftOut }
}
