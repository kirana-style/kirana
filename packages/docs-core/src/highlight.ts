/**
 * The one highlighter, shared by the markdown pipeline and the example compiler.
 *
 * It runs only in these scripts, so no grammar reaches the browser: pages ship
 * the markup it produced, coloured by the `--th-*` variables in `highlight.css`.
 *
 * The grammars colour keywords, strings and numbers; an editor also colours the
 * names around them. `enrich` adds that from the text the grammar left plain —
 * a call's name, a member or key, a JSX attribute, a command-line flag — so code
 * on a page reads the way it does in an editor.
 */
import { createHighlighter } from "@tanstack/highlight/core"
import { createTanStackMarkdownHighlighter } from "@tanstack/highlight/markdown"
import { css } from "@tanstack/highlight/languages/css"
import { diff } from "@tanstack/highlight/languages/diff"
import { json } from "@tanstack/highlight/languages/json"
import { markdown } from "@tanstack/highlight/languages/markdown"
import { plaintext } from "@tanstack/highlight/languages/plaintext"
import { shell } from "@tanstack/highlight/languages/shell"
import { ts } from "@tanstack/highlight/languages/ts"
import { tsx } from "@tanstack/highlight/languages/tsx"

export const highlighter = createHighlighter({
  fallbackLanguage: "plaintext",
  languages: [plaintext, ts, tsx, css, json, shell, diff, markdown],
})

const highlight = createTanStackMarkdownHighlighter(highlighter)

const SCRIPT = new Set(["ts", "tsx", "js", "jsx", "typescript", "javascript"])
const SHELL = new Set(["sh", "shell", "bash", "zsh"])

/** The inner markup of a `<code>` element: `th-line` rows of `th-token` spans. */
export function highlightSource(
  source: string,
  lang: string,
  options: { meta?: string; highlightLines?: number[] } = {}
): string {
  return enrich(highlight(source, lang, options), lang)
}

const span = (kind: string, text: string) =>
  `<span class="th-token th-${kind}">${text}</span>`

/** Keywords that declare the name after them: that name is a binding, not an attribute. */
const DECLARE = new Set([
  "const",
  "let",
  "var",
  "function",
  "class",
  "type",
  "interface",
  "import",
  "export",
])

/**
 * Colours the plain names in one stretch of text the grammar left alone. `previous`
 * is the last word before the stretch, which may sit in a grammar span (`const`).
 */
function names(text: string, lang: string, previous: string): string {
  if (SHELL.has(lang))
    return text.replace(
      /(^|\s)(--?[A-Za-z][\w-]*)/g,
      (_, space, flag) => `${space}${span("attr", flag)}`
    )
  if (!SCRIPT.has(lang)) return text
  let last = previous
  // Entities (`&quot;`) are skipped whole, so their letters are never a name.
  return text.replace(/&#?\w+;|[A-Za-z_$][\w$]*/g, (word, offset: number) => {
    if (word.startsWith("&")) return word
    const head = text.slice(0, offset)
    const before = head.trimEnd().at(-1) ?? ""
    const after = text.slice(offset + word.length).trimStart()
    const declared = DECLARE.has(last)
    last = word
    if (/&lt;\/?$/.test(head)) return span("tag", word)
    if (after.startsWith("(")) return span("function", word)
    if (before === "." && !head.endsWith("...")) return span("property", word)
    if (declared) return word
    if (/^=(?![=>])/.test(after)) return span("attr", word)
    if (/^:(?!:)/.test(after) && /^[{,(]?$/.test(before))
      return span("property", word)
    return word
  })
}

/** The grammar's markup with the names it left plain coloured too. */
export function enrich(html: string, lang: string): string {
  let previous = ""
  return html.replace(
    /(<span\b[^>]*>([\s\S]*?)<\/span>)|([^<]+)/g,
    (
      _,
      tag: string | undefined,
      inner: string | undefined,
      text: string | undefined
    ) => {
      if (tag) {
        previous = /[A-Za-z_$][\w$]*$/.exec(inner!)?.[0] ?? previous
        return tag
      }
      const out = names(text!, lang, previous)
      previous =
        /[A-Za-z_$][\w$]*(?=[^A-Za-z_$]*$)/.exec(text!)?.[0] ?? previous
      return out
    }
  )
}

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

/** Commands an inline span starts with that make it a shell line. */
const COMMANDS =
  /^(kirana-style|kirana|npx|npm|pnpm|yarn|bun|bunx|node|cargo|git|deno|cd)(\s|$)/

/** CSS functions an inline value starts with: `calc(…)`, `var(--x)`, `light-dark(…)`. */
const CSS_VALUE =
  /^(calc|var|color-mix|light-dark|oklch|oklab|rgb|hsl|repeat|minmax|clamp|min|max|url|cubic-bezier|steps)\(/

/** Text outside `[…]` brackets, where a utility's arbitrary value lives. */
const outsideBrackets = (value: string) =>
  value.replace(/\[[^\]]*\]|\(--[\w-]+\)/g, "")

/** The flags of Kirana's commands, which a `--name` alone means rather than a custom property. */
const FLAGS =
  /^--(dry-run|yes|install|preset|json|html|out|minify|format|stats|write|report|webpack|force|config-json)$/

/**
 * Whether a span is Tailwind utilities (`p-4`, `hover:bg-blue-600/50`,
 * `data-[state=open]:`): words of letters, digits, dashes, slashes and variant colons,
 * with any punctuation of code only inside brackets.
 */
function isUtility(value: string): boolean {
  const outside = outsideBrackets(value)
  if (/[{}=(),"'`]/.test(outside) || /[A-Za-z]\.[A-Za-z]/.test(outside))
    return false
  return outside
    .split(/\s+/)
    .every(
      (word) =>
        /^-?[@a-z0-9][\w\-/:.%@]*$|^-?\[\]:?$|^:?$/.test(word) &&
        !/[A-Z]/.test(word)
    )
}

/**
 * The language of an inline code span, from its text: a command line, a file or
 * package name, CSS (an at-rule, a custom property, a function value), Tailwind
 * utilities, or — the rest — a TypeScript expression.
 */
export function inlineLang(value: string): string {
  if (COMMANDS.test(value) || FLAGS.test(value)) return "shell"
  if (
    /^[\w.-]+\.(json|tsx?|jsx?|mjs|cjs|mts|cts|css|md|ya?ml|toml|lock|node|wasm|vue|svelte|astro)$/.test(
      value
    ) ||
    /^@[a-z][\w-]*\/[\w./-]+$/.test(value)
  )
    return "plaintext"
  if (
    /^@(layer|media|container|supports|property|keyframes|import)\b|^\.[a-z][\w-]*\s*\{/.test(
      value
    )
  )
    return "css"
  if (CSS_VALUE.test(value) || /^--[a-z][\w-]*(\(|$)/.test(value))
    return "css-value"
  if (isUtility(value)) return "utility"
  return "tsx"
}

/** A CSS value: functions, custom properties, numbers with units, `<placeholders>`. */
function cssValue(value: string): string {
  return escape(value).replace(
    /(--[\w-]+)|([a-z][\w-]*)(?=\()|(-?\d*\.?\d+(?:rem|px|em|ms|s|deg|turn|%|fr|ch|vh|vw)?)|(&lt;[^&]*&gt;)/g,
    (match, variable, fn, number, placeholder) =>
      variable
        ? span("variable", variable)
        : fn
          ? span("function", fn)
          : number
            ? span("number", number)
            : span("comment", placeholder ?? match)
  )
}

/** Tailwind utilities: variants in one colour, arbitrary values as strings, numbers as numbers. */
function utility(value: string): string {
  return escape(value).replace(
    /((?:[@\w-]*\[[^\]]*\]|[@\w-]+)(?:\/[\w-]+)?:)(?=\S|$)|(\[[^\]]*\])|(\(--[\w-]+\))|(\b\d+(?:\.\d+)?%?)|(\/\d+)/g,
    (match, variant, bracket, variable, number, alpha) =>
      variant
        ? span("attr", variant)
        : bracket
          ? span("string", bracket)
          : variable
            ? span("variable", variable)
            : span("number", number ?? alpha ?? match)
  )
}

/** An inline code span's markup, highlighted in the language its text looks like. */
export function highlightInline(value: string): string {
  const lang = inlineLang(value)
  if (lang === "css-value") return cssValue(value)
  if (lang === "utility") return utility(value)
  if (lang === "plaintext") return escape(value)
  if (FLAGS.test(value)) return span("attr", value)
  return highlightSource(value, lang)
}

/**
 * A terminal session: `$ ` lines are commands, highlighted as shell after a prompt;
 * the rest is the program's output, coloured the way a terminal colours it —
 * errors red, warnings amber, help and passes green, a diff's lines by side.
 * Bash blocks (`commands`) are every line a command, except comments.
 */
export function highlightTerminal(source: string, commands = false): string {
  const prompt = span("prompt", "$")
  const command = (line: string) => `${prompt} ${highlightSource(line, "bash")}`
  return source
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => {
      if (commands) {
        if (line.trim() === "" || line.trimStart().startsWith("#"))
          return highlightSource(line, "bash")
        return command(line)
      }
      if (line.startsWith("$ ")) return command(line.slice(2))
      const text = escape(line)
      const head = /^(\s*)(error|warning)(\[[A-Z]+\d+\])?(\s+[\w-]+)?:/.exec(
        line
      )
      if (head) {
        const kind = head[2] === "error" ? "deleted" : "type"
        return `${head[1]}${span(kind, escape(head[2]! + (head[3] ?? "")))}${span("strong", escape(head[4] ?? ""))}${escape(line.slice(head[0].length - 1))}`
      }
      if (/^\s*help:/.test(line))
        return text.replace("help:", span("inserted", "help:"))
      if (/^\s*(✓|All good)/.test(line))
        return text.replace(/(✓|All good\.?)/, (mark) => span("inserted", mark))
      if (/^\s*✗/.test(line)) return text.replace("✗", span("deleted", "✗"))
      if (/^\s*! /.test(line)) return text.replace("!", span("type", "!"))
      if (/^(\+\+\+|---) /.test(line)) return span("strong", text)
      if (line.startsWith("+ ")) return span("inserted", text)
      if (line.startsWith("- ")) return span("deleted", text)
      if (/^\s*(…|-->|\d+ (diagnostic|file|module))/.test(line))
        return span("comment", text)
      return text
    })
    .join("\n")
}

/** One hint an editor writes after a line: the line's index, and what it says. */
export type HintLine = { line: number; text: string }

/**
 * An `editor` block's source, with the `//: …` notes taken off the lines they end:
 * the code to highlight, and each note as the hint the editor writes after that line.
 */
export function splitHints(source: string): {
  code: string
  hints: HintLine[]
} {
  const hints: HintLine[] = []
  const code = source
    .replace(/\n$/, "")
    .split("\n")
    .map((line, index) => {
      const at = line.indexOf("//:")
      if (at < 0) return line
      hints.push({ line: index, text: line.slice(at + 3).trim() })
      return line.slice(0, at).trimEnd()
    })
    .join("\n")
  return { code, hints }
}
