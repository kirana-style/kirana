/**
 * Vue, Svelte and Astro components (KRN-INT-004, `design-notes/sfc-masking.md`): each script block is
 * compiled as a module of its own, and each `sx` binding in the template becomes a spread of the
 * private runtime's `sx()`, created with the `class` attribute. The framework's own parser finds the
 * blocks and bindings; Kirana never parses template syntax.
 */
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import MagicString from "magic-string"

import type { ImportFile } from "./config.ts"
import type { Diagnostic } from "./diagnostics.ts"

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
  /** Svelte and Astro: the element's own class and style, folded into the call and removed. */
  class?: { start: number; end: number; expression: string }
  style?: { start: number; end: number; expression: string }
  /**
   * Vue: the element's own `v-bind="…"` object. An element takes one, so it is folded into the call
   * with Vue's `mergeProps` and removed (`v-bind="attrs" :sx="[own, sx]"`, `useSx()`).
   */
  spread?: { start: number; end: number; expression: string }
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

/** Vue's own merge of attribute objects, for an element whose `v-bind="…"` is folded into `:sx`. */
const MERGE = `import { mergeProps as __kirana_merge } from "vue";\n`

/**
 * Svelte and Astro set `style` from a spread as text, so the runtime's style object (bridged custom
 * properties) becomes a declaration list, after the element's own `style`.
 */
const ATTRS = `const __kirana_attrs = (handles, classes, style) => {
  const props = __kirana_sfc.sx(handles, classes, []);
  const own = props.style ? Object.entries(props.style).map(([name, value]) => name + ":" + value).join(";") : "";
  return { class: props.class, style: [style, own].filter(Boolean).join(";") || undefined };
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
      const own = (name: string) => {
        const found = attributes!.find(
          (candidate) =>
            candidate.type === "Attribute" && candidate.name === name
        )
        const expression = found && expressionOf(found.value)
        return expression === undefined
          ? undefined
          : { start: found!.start, end: found!.end, expression }
      }
      bindings.push({
        start: sx.start,
        end: sx.end,
        expression: source.slice(
          (single[0] as { expression: { start: number } }).expression.start,
          (single[0] as { expression: { end: number } }).expression.end
        ),
        class: own("class"),
        style: own("style"),
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
  name?: { name?: unknown }
  value?: (EstreeNode & { value?: unknown; expression?: EstreeNode }) | null
  attributes?: EstreeNode[]
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
      const own = (name: string) => {
        const found = named(name)
        const text = found && expressionOf(found)
        return text === undefined
          ? undefined
          : { start: found!.start, end: found!.end, expression: text }
      }
      bindings.push({
        start: sx.start,
        end: sx.end,
        expression: source.slice(expression.start, expression.end),
        class: own("class"),
        style: own("style"),
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
    if (
      !name?.startsWith(found.name) ||
      source.slice(end - value.length, end) !== value
    ) {
      throw new Error(
        `Kirana could not locate the \`${found.name}\` attribute at offset ${start}`
      )
    }
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
      const own = (name: string) => {
        const found = node.attributes!.find(
          (candidate) => candidate.name === name
        )
        return found && span(found)
      }
      bindings.push({
        ...span(sx)!,
        expression: sx.value,
        class: own("class"),
        style: own("style"),
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
  compile: (id: string, code: string) => BlockResult
  load: ImportFile
}): Promise<ComponentResult> {
  const { file, source, root, prefix, compile, load } = options
  const framework = frameworkOf(file)!
  const parsed = await parseComponent(file, source, root, load)

  const magic = new MagicString(source)
  const result: ComponentResult = {
    diagnostics: [],
    cssChanged: false,
    dependencies: [],
    modules: [],
  }
  const injection =
    parsed.bindings.length === 0
      ? ""
      : runtime(prefix) + (framework === "vue" ? MERGE : ATTRS)

  for (const block of parsed.blocks) {
    const id = `${file}.${block.label}.${block.lang}`
    const content = source.slice(block.start, block.end)
    const compiled = compile(id, content)
    result.modules.push(id)
    result.cssChanged ||= compiled.cssChanged
    result.dependencies.push(...compiled.dependencies)
    // Diagnostics point into the component, not into the block's module.
    const suffix = `.${block.label}.${block.lang}`
    for (const diagnostic of compiled.diagnostics) {
      result.diagnostics.push({
        ...diagnostic,
        file: diagnostic.file.slice(0, -suffix.length),
        span: {
          start: diagnostic.span.start + block.start,
          end: diagnostic.span.end + block.start,
        },
      })
    }
    const extra = block === parsed.target ? injection : ""
    const text = extra + (compiled.code ?? content)
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
      const props = `__kirana_sfc.sx([${binding.expression}], [], [])`
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
    const classes = binding.class ? `[${binding.class.expression}]` : "[]"
    const style = binding.style?.expression ?? "undefined"
    for (const own of [binding.class, binding.style]) {
      if (own) magic.remove(own.start, own.end)
    }
    magic.overwrite(
      binding.start,
      binding.end,
      `{...__kirana_attrs([${binding.expression}], ${classes}, ${style})}`
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
