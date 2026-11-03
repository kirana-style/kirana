/**
 * Vue, Svelte and Astro components (KRN-INT-004, `design-notes/sfc-masking.md`): each script block is
 * compiled as a module of its own, and each `sx` binding in the template becomes a spread of the
 * private runtime's `sx()`, created with the `class` attribute. The framework's own parser finds the
 * blocks and bindings; Kirana never parses template syntax.
 */
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import MagicString from "magic-string"

import type { ImportFile } from "./config.ts"
import type { Diagnostic } from "./diagnostics.ts"
import { loadNative } from "./native.ts"

export type Framework = "vue" | "svelte" | "astro"

/** A component file of one of the three frameworks. */
export const COMPONENT = /\.(vue|svelte|astro)$/

export function frameworkOf(file: string): Framework | undefined {
  return COMPONENT.exec(file)?.[1] as Framework | undefined
}

/** What compiling one script block produced (the Driver's `transform`, narrowed). */
export type BlockResult = {
  code?: string
  diagnostics: Diagnostic[]
  cssChanged: boolean
  dependencies: string[]
}

export type ComponentResult = {
  code?: string
  map?: string
  diagnostics: Diagnostic[]
  cssChanged: boolean
  dependencies: string[]
  /** The block modules the engine now knows for this component. */
  modules: string[]
}

type Block = {
  /** `setup`, `script`, `instance`, `module` or `frontmatter`: part of the block's module id. */
  label: string
  start: number
  end: number
  lang: string
}
type Binding = {
  start: number
  end: number
  expression: string
  /** Svelte and Astro: what gives the element its class and style, folded into the call. */
  given?: Given[]
  /**
   * Vue: the element's own `v-bind="…"` object. An element takes one, so it is folded into the call
   * with Vue's `mergeProps` and removed (`v-bind="attrs" :sx="[own, sx]"`, `useSx()`).
   */
  spread?: { start: number; end: number; expression: string }
  /**
   * On a component, not an element: what arrives is the caller's `sx` for the component's own merge,
   * so its removals (`"*": null`) stay in the class (KF-089).
   */
  component?: boolean
}
/**
 * Svelte and Astro: something that gives an element its class and style, in the order written. An
 * own `class` or `style` attribute is folded into the call and removed. A spread written before the
 * `sx` gives its object's `class` and `style` (KF-098); its span is its expression's.
 */
type Given = {
  kind: "class" | "style" | "spread"
  start: number
  end: number
  expression: string
}
type Parsed = {
  blocks: Block[]
  bindings: Binding[]
  /** The block the template sees, where the runtime goes; undefined when the component has none. */
  target: Block | undefined
}

/** The runtime the template's spreads call, created with the `class` attribute. */
const runtime = (prefix: string) =>
  `\nimport { runtime as __kirana_runtime_sfc } from "@kirana-style/core/internal";\nconst __kirana_sfc = __kirana_runtime_sfc(${JSON.stringify(prefix)}, "class");\n`

/** Kirana's imports in a block: `import { props as styleProps, cx } from "@kirana-style/core"`. */
const CORE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']@kirana-style\/core["']/g

/**
 * Kirana's `props` and `cx` a template calls, by the names the block it sees imports them under
 * (KF-096). The engine compiles the block's own calls and drops the import, but a template's call
 * runs as written, so the build defines the name from the runtime the template's spreads use:
 * `props` as its merge into the configured class attribute, `cx` as its merge into one handle.
 */
export function templateHelpers(
  source: string,
  blocks: readonly { start: number; end: number }[],
  target: { start: number; end: number } | undefined
): { local: string; api: "props" | "cx" }[] {
  if (!target) return []
  let template = ""
  let at = 0
  for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
    template += source.slice(at, block.start)
    at = block.end
  }
  template += source.slice(at)
  const found: { local: string; api: "props" | "cx" }[] = []
  for (const [, names] of source
    .slice(target.start, target.end)
    .matchAll(CORE_IMPORT)) {
    for (const specifier of names!.split(",")) {
      const [imported, local = imported] = specifier
        .trim()
        .split(/\s+as\s+/)
        .map((name) => name.trim())
      if (imported !== "props" && imported !== "cx") continue
      if (calls(template, local!)) found.push({ local: local!, api: imported })
    }
  }
  return found
}

/**
 * Whether `text` calls `name`: the name, not part of a longer one or a member (`x.name`), then `(`.
 * Found by search rather than a pattern built from the name, which would have to escape it.
 */
function calls(text: string, name: string): boolean {
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
    if (/[\w$.]/.test(text.charAt(at - 1))) continue
    let next = at + name.length
    while (/\s/.test(text.charAt(next))) next++
    if (text.charAt(next) === "(") return true
  }
  return false
}

/**
 * The definitions of the helpers a template calls. The engine always drops Kirana's import from the
 * block (a read it cannot compile is `props must be called where it is used`), so the names are free.
 */
function helperDefinitions(
  helpers: readonly { local: string; api: "props" | "cx" }[],
  prefix: string,
  classAttribute: string
): string {
  if (helpers.length === 0) return ""
  let text = `\nconst __kirana_props = __kirana_runtime_sfc(${JSON.stringify(prefix)}, ${JSON.stringify(classAttribute)});\n`
  for (const { local, api } of helpers) {
    text +=
      api === "props"
        ? `const ${local} = (...handles) => __kirana_props.sx(handles, [], []);\n`
        : `const ${local} = __kirana_props.cx;\n`
  }
  return text
}

/**
 * A template's `sx` is compiled at runtime, so the engine never sees a relation's anchor named only
 * there (`:sx="[scope.anchor, sx]"`) and would report the relation's reads unanchored (KF-088). The
 * chains a binding names that end in `.anchor` are appended to the block the template sees, in a
 * function never called, and cut from what the engine returns: only the chains, since compiling the
 * whole binding would compile what it calls (a recipe, the runtime) into the block too. A chain
 * starts at a name's first character, after no `.`, `)` or `]`, which would make it a member of
 * something else, and after no `@`, an Ember argument; Ember's helpers take theirs after a space
 * (`{{sx folder.anchor}}`). The lookahead comes first, so the lookbehinds, which scan back over
 * spaces, run only where a name starts and the search stays linear in V8.
 */
const CHAINS =
  /(?=[A-Za-z_$])(?<![\w$])(?<![.)\]@]\s*)[A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)*/g

/** Where the appended anchors start: a comment, which the engine leaves as it is. */
const APPENDED = "\n/* kirana: the template's anchors (KF-088) */"

/**
 * What the build appends to the block a template sees: the anchors its bindings name, or nothing.
 * The lint rules compile a linted block with the same text (KF-090).
 */
export function templateAnchors(
  bindings: readonly { expression: string }[]
): string {
  const anchors = bindings.flatMap(({ expression }) =>
    [...expression.matchAll(CHAINS)]
      .map(([chain]) => chain)
      .filter((chain) => /\.\s*anchor$/.test(chain))
  )
  return anchors.length ? `${APPENDED}\n;() => [${anchors.join(", ")}];\n` : ""
}

/**
 * A compile of `code` with `appended` anchors, as if they had not been appended: the code cut where
 * they start, and what the engine said of them, the template's, which the build does not check,
 * dropped. Spans count UTF-8 bytes.
 */
export function withoutAnchors<
  T extends { code?: string; diagnostics: Diagnostic[] },
>(result: T, code: string, appended: string): T {
  if (!appended) return result
  const length = Buffer.byteLength(code)
  return {
    ...result,
    code: result.code?.slice(0, result.code.lastIndexOf(APPENDED)),
    diagnostics: result.diagnostics.filter(
      (diagnostic) => diagnostic.span.start < length
    ),
  }
}

/** Ember's template-tag modules (D-072). */
const TEMPLATE_TAG = /\.g[jt]s$/

/**
 * The texts between each `open` and the `close` after it. Found by index: a lazy pattern
 * (`{{([\s\S]*?)}}`) backtracks over the rest of the text from every unclosed `open`.
 */
function between(text: string, open: string, close: string): string[] {
  const found: string[] = []
  let start = text.indexOf(open)
  while (start >= 0) {
    const end = text.indexOf(close, start + open.length)
    if (end < 0) break
    found.push(text.slice(start + open.length, end))
    start = text.indexOf(open, end + close.length)
  }
  return found
}

/**
 * The anchors a module's own template names, for `Driver.transform` to append as a component's are
 * (KF-088, KF-090): an Angular component's `[sx]` bindings (D-068), from its inline template or the
 * `.html` file its `templateUrl` names, or the mustaches of an Ember template tag (D-072). The engine
 * compiles such a module without its template, which is a string, another file, or data once
 * Embroider has compiled it, so an anchor written only there was reported missing. A host compiling
 * Angular's or Embroider's output finds the template in the source on disk. The template's names are
 * read in the module's scope: a component member holding a relation has the relation's name.
 */
export function moduleAnchors(id: string, code: string): string {
  const query = id.search(/[?#]/)
  const file = query < 0 ? id : id.slice(0, query)
  const source = (marker: string) =>
    code.includes(marker)
      ? code
      : existsSync(file)
        ? readFileSync(file, "utf8")
        : ""
  if (TEMPLATE_TAG.test(file)) {
    const expressions = between(
      source("<template>"),
      "<template>",
      "</template>"
    ).flatMap((template) =>
      between(template, "{{", "}}").map((expression) => ({ expression }))
    )
    return templateAnchors(expressions)
  }
  if (!code.includes("@Component(") && !code.includes("ɵcmp")) return ""
  const expressions = JSON.parse(
    loadNative().angularBindings(file, source("@Component("))
  ) as string[]
  return templateAnchors(expressions.map((expression) => ({ expression })))
}

/** Vue's own merge of attribute objects, for an element whose `v-bind="…"` is folded into `:sx`. */
const MERGE = `import { mergeProps as __kirana_merge } from "vue";\n`

/**
 * Svelte and Astro set `style` from a spread as text, so the runtime's style object (bridged custom
 * properties) becomes a declaration list, after the styles the element is given, in their order. An
 * object (Astro's `style={{ … }}`) is written as Astro writes one: camel case to kebab case, custom
 * properties as they are. A class may be Svelte's `ClassValue` (an array or an object of
 * conditions, which a part's caller and Ark's props hand on), joined as Svelte joins one.
 */
const ATTRS = `const __kirana_class = (value) => Array.isArray(value) ? value.map(__kirana_class).filter(Boolean).join(" ") : value && typeof value === "object" ? Object.keys(value).filter((key) => value[key]).join(" ") : value;
const __kirana_text = (style) => style && typeof style === "object" ? Object.entries(style).map(([name, value]) => (name.startsWith("--") ? name : name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase())) + ":" + value).join(";") : style;
const __kirana_attrs = (handles, classes, styles, component) => {
  const props = __kirana_sfc.sx(handles, classes.map(__kirana_class), [], component);
  return { class: props.class, style: [...styles, props.style].map(__kirana_text).filter(Boolean).join(";") || undefined };
};
`

/**
 * Astro writes each spread's attributes where it stands and the browser keeps an attribute's first
 * value, so a spread folded into an element's `sx` gives its class and style there only: before the
 * `sx`, it is spread without them.
 */
const REST = `const __kirana_rest = (attributes) => {
  if (!attributes || typeof attributes !== "object") return attributes;
  const { class: _class, style: _style, ...rest } = attributes;
  return rest;
};
`

/**
 * Loads a framework's parser from the application, which has the framework installed; undefined when
 * none of the places it can be has it. `"astro @astrojs/compiler"` means "resolved from `astro`",
 * for package managers that do not hoist a framework's own dependencies (pnpm).
 */
async function parser<Module>(
  root: string,
  specifiers: readonly string[],
  load: ImportFile
): Promise<Module | undefined> {
  const require = createRequire(path.join(root, "package.json"))
  for (const specifier of specifiers) {
    const [from, name] = specifier.split(" ") as [string, string | undefined]
    let resolved: string
    try {
      resolved = name
        ? createRequire(require.resolve(`${from}/package.json`)).resolve(name)
        : require.resolve(from)
    } catch {
      continue
    }
    const loaded = (await load(pathToFileURL(resolved).href)) as {
      default?: Module
    }
    // A CommonJS build (Svelte's `require` entry) arrives as the default export.
    return ("parse" in loaded ? loaded : loaded.default) as Module
  }
  return undefined
}

function required<Module>(module: Module | undefined, name: string): Module {
  if (module === undefined) {
    throw new Error(
      `Kirana needs ${name} to compile this component; it is installed with the framework`
    )
  }
  return module
}

/** A value for an HTML attribute that holds `text`, quoted so the text survives. */
function quoted(name: string, text: string): string {
  if (!text.includes('"')) return `${name}="${text}"`
  if (!text.includes("'")) return `${name}='${text}'`
  return `${name}="${text.replaceAll('"', "&quot;")}"`
}

type VueNode = {
  type: number
  /** An element's kind: 1 for a component (`<Button>`, `<component :is>`). */
  tagType?: number
  props?: {
    type: number
    name: string
    arg?: { content: string }
    exp?: { content: string }
    loc: { start: { offset: number }; end: { offset: number } }
  }[]
  children?: VueNode[]
}

async function parseVue(
  source: string,
  file: string,
  root: string,
  load: ImportFile
): Promise<Parsed> {
  const { parse } = required(
    await parser<{
      parse: (
        source: string,
        options: { filename: string }
      ) => {
        descriptor: {
          template: { ast?: VueNode } | null
          script: VueBlock | null
          scriptSetup: VueBlock | null
        }
      }
    }>(root, ["vue/compiler-sfc", "@vue/compiler-sfc"], load),
    "vue/compiler-sfc"
  )
  type VueBlock = {
    lang?: string
    loc: { start: { offset: number }; end: { offset: number } }
  }
  const { descriptor } = parse(source, { filename: file })
  const block = (label: string, found: VueBlock | null) =>
    found && {
      label,
      start: found.loc.start.offset,
      end: found.loc.end.offset,
      lang: found.lang ?? "js",
    }
  const script = block("script", descriptor.script)
  const setup = block("setup", descriptor.scriptSetup)
  const bindings: Binding[] = []
  const walk = (node: VueNode) => {
    // `v-bind="…"`: a directive (7) binding no argument, an object of attributes.
    const object = node.props?.find(
      (prop) => prop.type === 7 && prop.name === "bind" && !prop.arg && prop.exp
    )
    for (const prop of node.props ?? []) {
      // `:sx="…"` and `v-bind:sx="…"`: a directive (7) binding the `sx` argument.
      if (
        prop.type === 7 &&
        prop.name === "bind" &&
        prop.arg?.content === "sx" &&
        prop.exp
      ) {
        bindings.push({
          start: prop.loc.start.offset,
          end: prop.loc.end.offset,
          expression: prop.exp.content,
          component: node.tagType === 1,
          ...(object
            ? {
                spread: {
                  start: object.loc.start.offset,
                  end: object.loc.end.offset,
                  expression: object.exp!.content,
                },
              }
            : {}),
        })
      }
    }
    node.children?.forEach(walk)
  }
  if (descriptor.template?.ast) walk(descriptor.template.ast)
  return {
    blocks: [script, setup].filter((found) => found !== null),
    bindings,
    target: setup ?? undefined,
  }
}

/** Svelte's nodes for a component: `<Button>`, `<svelte:component this={…}>`, `<svelte:self>`. */
const SVELTE_COMPONENTS = new Set([
  "Component",
  "SvelteComponent",
  "SvelteSelf",
])

type SvelteValue =
  | true
  | { type: "ExpressionTag"; expression: { start: number; end: number } }
  | (
      | { type: "Text"; data: string }
      | { type: "ExpressionTag"; expression: { start: number; end: number } }
    )[]
type SvelteAttribute = {
  type: string
  name: string
  start: number
  end: number
  value: SvelteValue
  /** A spread's (`{...props()}`). */
  expression?: { start: number; end: number }
}

async function parseSvelte(
  source: string,
  root: string,
  load: ImportFile
): Promise<Parsed> {
  const { parse } = required(
    await parser<{
      parse: (
        source: string,
        options: { modern: true }
      ) => Record<string, unknown>
    }>(root, ["svelte/compiler"], load),
    "svelte/compiler"
  )
  type Script = {
    content: { start: number; end: number }
    attributes: { name: string; value: SvelteValue }[]
  } | null
  const ast = parse(source, { modern: true }) as {
    instance: Script
    module: Script
    fragment: unknown
  }
  const block = (label: string, script: Script) => {
    if (!script) return undefined
    const lang = script.attributes.find((found) => found.name === "lang")?.value
    return {
      label,
      start: script.content.start,
      end: script.content.end,
      lang:
        Array.isArray(lang) && lang[0]?.type === "Text" ? lang[0].data : "js",
    }
  }
  const instance = block("instance", ast.instance)
  const module = block("module", ast.module)

  /** An attribute's value as a JavaScript expression; undefined for a bare attribute. */
  const expressionOf = (value: SvelteValue): string | undefined => {
    if (value === true) return undefined
    const parts = Array.isArray(value) ? value : [value]
    return parts
      .map((part) =>
        part.type === "Text"
          ? JSON.stringify(part.data)
          : `(${source.slice(part.expression.start, part.expression.end)})`
      )
      .join(" + ")
  }
  const bindings: Binding[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== "object") return
    const attributes = (node as { attributes?: SvelteAttribute[] }).attributes
    const sx = attributes?.find(
      (found) => found.type === "Attribute" && found.name === "sx"
    )
    const single = sx && (Array.isArray(sx.value) ? sx.value : [sx.value])
    if (
      sx &&
      single?.length === 1 &&
      single[0] !== true &&
      single[0]!.type === "ExpressionTag"
    ) {
      const given: Given[] = []
      for (const attribute of attributes!) {
        if (attribute.type === "SpreadAttribute") {
          if (attribute.start > sx.start) continue
          const { start, end } = attribute.expression!
          given.push({
            kind: "spread",
            start,
            end,
            expression: source.slice(start, end),
          })
        } else if (
          attribute.type === "Attribute" &&
          (attribute.name === "class" || attribute.name === "style")
        ) {
          const expression = expressionOf(attribute.value)
          if (expression === undefined) continue
          given.push({
            kind: attribute.name,
            start: attribute.start,
            end: attribute.end,
            expression,
          })
        }
      }
      bindings.push({
        start: sx.start,
        end: sx.end,
        expression: source.slice(
          (single[0] as { expression: { start: number } }).expression.start,
          (single[0] as { expression: { end: number } }).expression.end
        ),
        given,
        component: SVELTE_COMPONENTS.has((node as { type: string }).type),
      })
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "attributes" && key !== "instance" && key !== "module")
        walk(value)
    }
  }
  walk(ast.fragment)
  return {
    blocks: [module, instance].filter((found) => found !== undefined),
    bindings,
    target: instance,
  }
}

type AstroAttribute = {
  kind: string
  name: string
  value: string
  raw: string
  position: { start: { offset: number } }
}
type AstroNode = {
  type: string
  value?: string
  attributes?: AstroAttribute[]
  children?: AstroNode[]
  position?: { start: { offset: number } }
}

type EstreeNode = {
  type?: string
  start: number
  end: number
  name?: { type?: string; name?: unknown }
  value?: (EstreeNode & { value?: unknown; expression?: EstreeNode }) | null
  attributes?: EstreeNode[]
  /** A spread attribute's (`{...props}`). */
  argument?: EstreeNode
}

/** Astro 7: `@astrojs/compiler-rs` returns an Oxc (ESTree) tree whose offsets are UTF-16, like strings. */
function astroRs(
  source: string,
  ast: {
    frontmatter: { start: number; end: number } | null
    body: unknown
  }
): Parsed {
  // A component without one still gets an empty frontmatter node, at 0–0.
  const fence =
    ast.frontmatter && source.startsWith("---", ast.frontmatter.start)
      ? ast.frontmatter
      : null
  const frontmatter = fence && {
    label: "frontmatter",
    start: fence.start + 3,
    end: fence.end - 3,
    lang: "ts",
  }
  /** A JSX attribute's value as an expression; undefined for a bare attribute. */
  const expressionOf = (attribute: EstreeNode) => {
    const value = attribute.value
    if (!value) return undefined
    return value.type === "Literal"
      ? JSON.stringify(value.value)
      : `(${source.slice(value.expression!.start, value.expression!.end)})`
  }
  const bindings: Binding[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== "object") return
    const { attributes } = node as EstreeNode
    const named = (name: string) =>
      attributes?.find(
        (attribute) =>
          attribute.type === "JSXAttribute" && attribute.name?.name === name
      )
    const sx = named("sx")
    const expression = sx?.value?.expression
    if (sx && expression && expression.type !== "JSXEmptyExpression") {
      const given: Given[] = []
      for (const attribute of attributes!) {
        if (attribute.type === "JSXSpreadAttribute") {
          if (attribute.start > sx.start) continue
          const { start, end } = attribute.argument!
          given.push({
            kind: "spread",
            start,
            end,
            expression: source.slice(start, end),
          })
          continue
        }
        const kind = attribute.name?.name
        if (kind !== "class" && kind !== "style") continue
        const text = expressionOf(attribute)
        if (text === undefined) continue
        given.push({
          kind,
          start: attribute.start,
          end: attribute.end,
          expression: text,
        })
      }
      const { name } = node as EstreeNode
      bindings.push({
        start: sx.start,
        end: sx.end,
        expression: source.slice(expression.start, expression.end),
        given,
        // Astro's rule: a capitalised name or a member (`<Card>`, `<ui.Card>`) is a component.
        component:
          name!.type === "JSXMemberExpression" ||
          /^[A-Z]/.test(String(name!.name)),
      })
    }
    Object.values(node).forEach(walk)
  }
  walk(ast.body)
  return {
    blocks: frontmatter ? [frontmatter] : [],
    bindings,
    target: frontmatter ?? undefined,
  }
}

async function parseAstro(
  source: string,
  root: string,
  load: ImportFile
): Promise<Parsed> {
  const rs = await parser<{
    parse: (source: string) => {
      ast: { frontmatter: { start: number; end: number } | null; body: unknown }
    }
  }>(root, ["@astrojs/compiler-rs", "astro @astrojs/compiler-rs"], load)
  if (rs) return astroRs(source, rs.parse(source).ast)
  // Astro 5 and 6: the Go compiler, whose attributes carry a start offset and their raw text.
  const { parse } = required(
    await parser<{
      parse: (
        source: string,
        options: { position: true }
      ) => Promise<{ ast: AstroNode }>
    }>(root, ["@astrojs/compiler", "astro @astrojs/compiler"], load),
    "@astrojs/compiler"
  )
  const { ast } = await parse(source, { position: true })
  let frontmatter: Block | undefined
  const bindings: Binding[] = []

  /** Checks that the source holds `text` where an attribute is said to end. */
  const located = (
    found: AstroAttribute,
    start: number,
    end: number,
    text: string | undefined
  ) => {
    if (text === undefined || source.slice(end - text.length, end) !== text) {
      throw new Error(
        `Kirana could not locate the \`${found.name}\` attribute at offset ${start}`
      )
    }
  }
  /** Where an attribute ends, checked against the source; undefined for kinds that are not folded. */
  const span = (found: AstroAttribute) => {
    const value =
      found.kind === "quoted"
        ? found.raw
        : found.kind === "expression"
          ? `{${found.value}}`
          : undefined
    if (value === undefined) return undefined
    const start = found.position.start.offset
    const name = /^[^\s=]+\s*=\s*/.exec(source.slice(start))?.[0]
    const end = start + (name?.length ?? 0) + value.length
    located(found, start, end, name?.startsWith(found.name) ? value : undefined)
    return {
      start,
      end,
      expression:
        found.kind === "quoted"
          ? JSON.stringify(found.value)
          : `(${found.value})`,
    }
  }
  const walk = (node: AstroNode) => {
    if (node.type === "frontmatter") {
      const start = node.position!.start.offset + 3
      frontmatter = {
        label: "frontmatter",
        start,
        end: start + node.value!.length,
        lang: "ts",
      }
    }
    const sx = node.attributes?.find(
      (found) => found.name === "sx" && found.kind === "expression"
    )
    if (sx) {
      const given: Given[] = []
      for (const found of node.attributes!) {
        if (found.kind === "spread") {
          // The offset is the expression's, which the attribute's name holds.
          const start = found.position.start.offset
          if (start > sx.position.start.offset) continue
          located(found, start, start + found.name.length, found.name)
          given.push({
            kind: "spread",
            start,
            end: start + found.name.length,
            expression: found.name,
          })
          continue
        }
        if (found.name !== "class" && found.name !== "style") continue
        const at = span(found)
        if (at) given.push({ kind: found.name, ...at })
      }
      bindings.push({
        ...span(sx)!,
        expression: sx.value,
        given,
        component: node.type === "component",
      })
    }
    node.children?.forEach(walk)
  }
  walk(ast)
  return {
    blocks: frontmatter ? [frontmatter] : [],
    bindings,
    target: frontmatter,
  }
}

/**
 * Where a component's script blocks and `sx` bindings are, by the framework's own parser. The
 * language server finds the same with a scanner of its own (`kirana_frontend::sfc`);
 * `test/sfc-scan.test.ts` compares the two.
 */
export async function parseComponent(
  file: string,
  source: string,
  root: string,
  load: ImportFile
): Promise<Parsed> {
  const framework = frameworkOf(file)!
  return framework === "vue"
    ? parseVue(source, file, root, load)
    : framework === "svelte"
      ? parseSvelte(source, root, load)
      : parseAstro(source, root, load)
}

/**
 * Compiles one component: its script blocks through `compile`, its `sx` bindings into runtime
 * spreads. Undefined `code` when nothing changed.
 */
export async function compileComponent(options: {
  file: string
  source: string
  root: string
  prefix: string
  /** The attribute `props()` returns classes under: `className`, or `class` (KF-047). */
  classAttribute?: string
  compile: (id: string, code: string) => BlockResult
  load: ImportFile
}): Promise<ComponentResult> {
  const { file, source, root, prefix, compile, load } = options
  const classAttribute = options.classAttribute ?? "className"
  const framework = frameworkOf(file)!
  const parsed = await parseComponent(file, source, root, load)

  const magic = new MagicString(source)
  const result: ComponentResult = {
    diagnostics: [],
    cssChanged: false,
    dependencies: [],
    modules: [],
  }
  const helpers = templateHelpers(source, parsed.blocks, parsed.target)
  const injection =
    (parsed.bindings.length > 0 || helpers.length > 0 ? runtime(prefix) : "") +
    (parsed.bindings.length === 0
      ? ""
      : framework === "vue"
        ? MERGE
        : framework === "astro"
          ? ATTRS + REST
          : ATTRS)

  for (const block of parsed.blocks) {
    const id = `${file}.${block.label}.${block.lang}`
    const content = source.slice(block.start, block.end)
    const appended =
      block === parsed.target ? templateAnchors(parsed.bindings) : ""
    const compiled = withoutAnchors(
      compile(id, content + appended),
      content,
      appended
    )
    const code = compiled.code
    result.modules.push(id)
    result.cssChanged ||= compiled.cssChanged
    result.dependencies.push(...compiled.dependencies)
    // Diagnostics point into the component, not into the block's module. Spans count UTF-8 bytes,
    // the parser's offsets characters.
    const suffix = `.${block.label}.${block.lang}`
    const start = Buffer.byteLength(source.slice(0, block.start))
    for (const diagnostic of compiled.diagnostics) {
      result.diagnostics.push({
        ...diagnostic,
        file: diagnostic.file.slice(0, -suffix.length),
        span: {
          start: diagnostic.span.start + start,
          end: diagnostic.span.end + start,
        },
      })
    }
    const extra = block === parsed.target ? injection : ""
    const defined =
      block === parsed.target
        ? helperDefinitions(helpers, prefix, classAttribute)
        : ""
    const text = extra + (code ?? content) + defined
    if (text === content) continue
    if (block.start === block.end) magic.appendLeft(block.start, text)
    else magic.overwrite(block.start, block.end, text)
  }

  if (injection && !parsed.target) {
    // A component without the script its template sees gets one.
    if (framework === "vue") {
      const lang = parsed.blocks[0]?.lang
      magic.append(
        `\n<script setup${lang && lang !== "js" ? ` lang="${lang}"` : ""}>\n${injection}</script>\n`
      )
    } else if (framework === "svelte") {
      magic.prepend(`<script>\n${injection}</script>\n`)
    } else {
      magic.prepend(`---\n${injection}---\n`)
    }
  }

  for (const binding of parsed.bindings) {
    if (framework === "vue") {
      const props = `__kirana_sfc.sx([${binding.expression}], [], []${binding.component ? ", true" : ""})`
      if (binding.spread) magic.remove(binding.spread.start, binding.spread.end)
      magic.overwrite(
        binding.start,
        binding.end,
        quoted(
          "v-bind",
          binding.spread
            ? `__kirana_merge(${binding.spread.expression}, ${props})`
            : props
        )
      )
      continue
    }
    // What gives the element its class and style merges in the order written, so a later one wins
    // as it would without Kirana. A spread stays where it is, so every other attribute keeps its
    // precedence over it, and its class and style are read again at the `sx` (KF-098): its
    // expression runs twice. Svelte evaluates each spread in a derived of its own, which a
    // component's props read lazily, so a value kept from the first run could be stale.
    const classes: string[] = []
    const styles: string[] = []
    for (const given of binding.given!) {
      if (given.kind === "spread") {
        classes.push(`(${given.expression})?.class`)
        styles.push(`(${given.expression})?.style`)
        if (framework === "astro") {
          magic.overwrite(
            given.start,
            given.end,
            `__kirana_rest(${given.expression})`
          )
        }
      } else {
        ;(given.kind === "class" ? classes : styles).push(given.expression)
        magic.remove(given.start, given.end)
      }
    }
    magic.overwrite(
      binding.start,
      binding.end,
      `{...__kirana_attrs([${binding.expression}], [${classes.join(", ")}], [${styles.join(", ")}]${binding.component ? ", true" : ""})}`
    )
  }

  if (magic.hasChanged()) {
    result.code = magic.toString()
    result.map = magic
      .generateMap({ source: file, includeContent: true, hires: true })
      .toString()
  }
  return result
}
