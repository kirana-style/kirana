/**
 * A file's code with its formatting set aside (KF-136): what `ui add`, `update`, `diff` and `remove`
 * compare when a project's file is not byte for byte what was installed, so that a file the
 * project's formatter (Prettier, Biome, Oxfmt, `vp fmt`) rewrote reads as reformatted, not changed.
 *
 * The form is a list of tokens, without whitespace or comments, in which what formatters choose
 * freely is written one way: a string by its value, not its quotes; a number by its value; no
 * semicolons and no trailing commas; a `>` alone; no parentheses a formatter adds or drops (around
 * JSX, around a whole `return` value, arrow body, assigned value, spread or ternary branch, around an
 * arrow's one parameter); no leading `|` or `&` of a type; an object key without quotes where it
 * needs none; JSX text as React reads it, `{" "}` included, and `a={"b"}` as `a="b"`; the imports
 * sorted, and the names in each. CSS (and SCSS and Less), JSON and the markup
 * of Vue, Svelte, Astro and Angular components (each script and style block, each expression in the
 * markup, and an Angular component's inline `template`) are read the same way. Any other kind of
 * file, and a file its kind cannot read, has no form: it is compared byte for byte.
 *
 * A difference the form sets aside that is not formatting (a hand edit to a comment, to the spaces
 * in a line of JSX text, to the order of imports) reads as reformatted too: the project's file is
 * then kept, never lost. Changing the form changes the `code` hashes lockfiles record; one recorded
 * before reads as reformatted only through the file installing writes now.
 */
import { hashOf } from "./check.ts"

const fail = (): never => {
  throw new Error("unreadable")
}

const IDENTIFIER = /[A-Za-z_$#\u0080-\uffff][\w$\u0080-\uffff]*/y
const NUMBER =
  /(?:0[xXoObB][\da-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?/y
const DOUBLE = /"(?:[^"\\]|\\[\s\S])*"/y
const SINGLE = /'(?:[^'\\]|\\[\s\S])*'/y
const REGEX = /\/(?:[^/\\[\n\r]|\\.|\[(?:[^\]\\\n\r]|\\.)*\])+\/[a-z]*/y
const CHUNK = /(?:[^`\\$]|\\[\s\S]|\$(?!\{))*/y
/** Where `<` opens JSX: not `<T,>` or `<T extends U>`, a generic arrow function's parameters. */
const JSX_START = /<(?:>|[A-Za-z_$][\w$.:-]*(?![\w$.:-]|\s*,|\s+extends\s))/y
const JSX_NAME = /[A-Za-z_$][\w$.:-]*/y
const JSX_ATTRIBUTE = /[^\s=/>{"'<]+/y
const JSX_CLOSING = /<\/\s*([\w$.:-]*)\s*>/y
/** A JSX child that is one string, which React renders as text: `{" "}`. */
const TEXT_CHILD =
  /\{\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)')\s*\}/y
/** A JSX child that is only comments. */
const EMPTY_CHILD = /\{\s*(?:\/\*[\s\S]*?\*\/\s*)*\}/y
/** Longest first. A `>` stands alone: a formatter that wraps `Array<Array<T>>` writes `> >`. */
const PUNCTUATORS = [
  "...",
  "===",
  "!==",
  "**=",
  "<<=",
  "&&=",
  "||=",
  "??=",
  "=>",
  "==",
  "!=",
  "<=",
  "&&",
  "||",
  "??",
  "?.",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "**",
  "<<",
]
/** Tokens after which an expression starts: a `/` there opens a regular expression, a `<` JSX. */
const BEFORE_EXPRESSION = new Set([
  "${",
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
  "extends",
  "default",
])
/** Tokens that end an expression: a name, a literal, a closing bracket or JSX element. */
const ENDS_EXPRESSION = /^(?:["`\w$#\u0080-\uffff]|re\/|<\/|\/>$|[)\]}]$)/
/**
 * What may follow a parenthesised expression that is the whole of a value (see `WHOLE_AFTER`) or of a
 * ternary's branch; a name after it starts the next statement, unless it is an operator.
 */
const AFTER_WHOLE = new Set([";", "}", ")", "]", ",", ":", "@"])
/** What a parenthesised expression that is the whole of a value follows. */
const WHOLE_AFTER = new Set(["return", "=>", "=", "..."])
const OPERATOR_WORDS = new Set(["as", "satisfies", "in", "instanceof"])
/** What a type's leading `|` or `&` follows; a binary one never does. */
const BEFORE_TYPE = new Set([
  "=",
  "(",
  ",",
  ":",
  "<",
  "[",
  "{",
  "=>",
  "?",
  "as",
  "satisfies",
  "extends",
])
const NAME = /^[A-Za-z_$][\w$]*$/
const SIMPLE_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  0: "\0",
}

const isString = (token: string | undefined) => token?.startsWith('"')

/** Where `pattern` (global) first matches from `from`, or -1, without copying the text. */
function searchFrom(text: string, pattern: RegExp, from: number): number {
  pattern.lastIndex = from
  return pattern.exec(text)?.index ?? -1
}

/** JSX text as React reads it: each line trimmed where it meets another, blank lines dropped. */
function jsxText(text: string): string {
  const lines = text.split(/\r\n|\n|\r/)
  let last = 0
  lines.forEach((line, index) => {
    if (/[^ \t]/.test(line)) last = index
  })
  let result = ""
  lines.forEach((line, index) => {
    let trimmed = line.replace(/\t/g, " ")
    if (index > 0) trimmed = trimmed.replace(/^ +/, "")
    if (index < lines.length - 1) trimmed = trimmed.replace(/ +$/, "")
    if (trimmed) result += index === last ? trimmed : `${trimmed} `
  })
  return result
}

/** A string literal's value, its escapes read. */
const unescape = (body: string) =>
  body.replace(
    /\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|(\r\n|[\s\S]))/g,
    (_, point?: string, unit?: string, byte?: string, other?: string) => {
      const code = point ?? unit ?? byte
      if (code !== undefined) return String.fromCodePoint(parseInt(code, 16))
      return /^[\r\n\u2028\u2029]/.test(other!)
        ? ""
        : (SIMPLE_ESCAPES[other!] ?? other!)
    }
  )

/** Reads JavaScript, TypeScript and JSON into tokens, and JSX where `jsx`. */
class Script {
  readonly tokens: string[] = []
  /** Where each JSX element's tokens start and end, inclusive. */
  readonly elements: [number, number][] = []

  readonly source: string
  readonly jsx: boolean
  at: number

  constructor(source: string, jsx: boolean, at: number) {
    this.source = source
    this.jsx = jsx
    this.at = at
  }

  /** Steps over whitespace and comments. */
  private space(): void {
    for (;;) {
      while (/\s/.test(this.source[this.at] ?? "")) this.at++
      if (this.source.startsWith("//", this.at)) {
        const end = this.source.indexOf("\n", this.at)
        this.at = end < 0 ? this.source.length : end
      } else if (this.source.startsWith("/*", this.at)) {
        const end = this.source.indexOf("*/", this.at + 2)
        this.at = end < 0 ? fail() : end + 2
      } else return
    }
  }

  private exec(pattern: RegExp): RegExpExecArray | null {
    pattern.lastIndex = this.at
    const found = pattern.exec(this.source)
    if (found) this.at += found[0].length
    return found
  }

  private match(pattern: RegExp): string | undefined {
    return this.exec(pattern)?.[0]
  }

  /** Whether an expression may start here. */
  private expressionStarts(): boolean {
    const last = this.tokens.at(-1)
    const before = this.tokens.at(-2)
    if (last === undefined) return true
    // A postfix `!` (TypeScript's non-null assertion), `++` or `--` ends the expression it follows.
    if (/^(?:!|\+\+|--)$/.test(last) && ENDS_EXPRESSION.test(before ?? ""))
      return false
    return BEFORE_EXPRESSION.has(last) || !ENDS_EXPRESSION.test(last)
  }

  /** Code to the end, or to the `close` (`}` or `)`) that closes the one before it, left unread. */
  code(close?: string): void {
    let depth = 0
    for (;;) {
      this.space()
      const char = this.source[this.at]
      if (char === undefined) return close === undefined ? undefined : fail()
      if (char === close && depth === 0) return
      if (char === '"' || char === "'") this.string(char)
      else if (char === "`") this.template()
      else if (
        /\d/.test(char) ||
        /^\.\d/.test(this.source.slice(this.at, this.at + 2))
      )
        this.number()
      else if (char === "/" && this.expressionStarts()) this.regex()
      else if (
        char === "<" &&
        this.jsx &&
        this.expressionStarts() &&
        this.opensJsx()
      )
        this.element()
      else if (!this.word()) {
        if ("([{".includes(char)) depth++
        if (")]}".includes(char)) depth--
        const punctuator =
          PUNCTUATORS.find((entry) => this.source.startsWith(entry, this.at)) ??
          char
        this.at += punctuator.length
        this.tokens.push(punctuator)
      }
    }
  }

  private string(quote: string): void {
    const raw = this.match(quote === '"' ? DOUBLE : SINGLE) ?? fail()
    this.tokens.push(JSON.stringify(unescape(raw.slice(1, -1))))
  }

  private number(): void {
    const raw = this.match(NUMBER)!.replace(/_/g, "")
    this.tokens.push(
      raw.endsWith("n") ? raw.toLowerCase() : String(Number(raw))
    )
  }

  private word(): boolean {
    const word = this.match(IDENTIFIER)
    if (word !== undefined) this.tokens.push(word)
    return word !== undefined
  }

  private regex(): void {
    this.tokens.push(`re${this.match(REGEX) ?? fail()}`)
  }

  private template(): void {
    const [name, colon] = this.tokens.slice(-2)
    const start = this.tokens.length
    const chunks: string[] = []
    const substitutions: string[] = []
    this.at++
    for (;;) {
      const chunk = this.match(CHUNK)!.replace(/\r\n?/g, "\n")
      chunks.push(chunk)
      this.tokens.push(`\`${chunk}`)
      if (!this.source.startsWith("${", this.at)) break
      this.at += 2
      this.tokens.push("${")
      const mark = this.tokens.length
      this.code("}")
      this.at++
      substitutions.push("${", ...this.tokens.slice(mark), "}")
      this.tokens.push("}")
    }
    if (this.source[this.at] !== "`") fail()
    this.at++
    this.tokens.push("`")
    if (name !== "template" || colon !== ":") return
    // An Angular component's inline template is markup, which formatters format as markup: each
    // substitution stands in it as a name, and its code follows.
    const text = chunks
      .map((chunk, index) =>
        unescape(index === 0 ? chunk : `kirana${index}substitution${chunk}`)
      )
      .join("")
    this.tokens.splice(
      start,
      Infinity,
      `\`${markup(text, "angular").join("\n")}`,
      ...substitutions
    )
  }

  private opensJsx(): boolean {
    JSX_START.lastIndex = this.at
    return JSX_START.test(this.source)
  }

  private element(): void {
    const start = this.tokens.length
    this.at++
    if (this.source[this.at] === ">") {
      this.at++
      this.tokens.push("<>")
      this.children()
    } else {
      this.tokens.push(`<${this.match(JSX_NAME)}`)
      if (this.source[this.at] === "<") this.typeArguments()
      this.attributes()
    }
    this.elements.push([start, this.tokens.length - 1])
  }

  /** A generic component's type arguments, `<List<{ id: string }>>`, as script. */
  private typeArguments(): void {
    let depth = 0
    const start = this.at
    do {
      if (this.source.startsWith("=>", this.at)) this.at++
      else if (this.source[this.at] === "<") depth++
      else if (this.source[this.at] === ">") depth--
      else if (this.at >= this.source.length) fail()
      this.at++
    } while (depth > 0)
    this.tokens.push(
      "<",
      ...script(this.source.slice(start + 1, this.at - 1), false).tokens,
      ">"
    )
  }

  private attributes(): void {
    for (;;) {
      this.space()
      if (this.source.startsWith("/>", this.at)) {
        this.at += 2
        this.tokens.push("/>")
        return
      }
      const char = this.source[this.at]
      if (char === ">") {
        this.at++
        this.tokens.push(">")
        this.children()
        return
      }
      if (char === "{") {
        this.container()
        continue
      }
      this.tokens.push(this.match(JSX_ATTRIBUTE) ?? fail())
      this.space()
      if (this.source[this.at] !== "=") continue
      this.at++
      this.space()
      const value = this.source[this.at]
      if (value === '"' || value === "'") {
        const end = this.source.indexOf(value, this.at + 1)
        if (end < 0) fail()
        this.tokens.push(
          JSON.stringify(
            this.source.slice(this.at + 1, end).replace(/\r\n?/g, "\n")
          )
        )
        this.at = end + 1
      } else if (value === "{") this.container()
      else if (value === "<" && this.opensJsx()) this.element()
      else fail()
    }
  }

  /** `{…}`: a string alone as the string (`a={"b"}` is `a="b"`), nothing when empty. */
  private container(): void {
    const mark = this.tokens.length
    this.at++
    this.tokens.push("{")
    this.code("}")
    this.at++
    const inner = this.tokens.length - mark - 1
    if (inner === 0 || (inner === 1 && isString(this.tokens.at(-1))))
      this.tokens.splice(mark, 1)
    else this.tokens.push("}")
  }

  /** An element's children, then its closing tag. */
  private children(): void {
    let text = ""
    const flush = () => {
      if (text) this.tokens.push(`#${JSON.stringify(text)}`)
      text = ""
    }
    for (;;) {
      const next = searchFrom(this.source, /[<{]/g, this.at)
      if (next < 0) fail()
      text += jsxText(this.source.slice(this.at, next))
      this.at = next
      const literal = this.exec(TEXT_CHILD)
      if (literal) text += unescape(literal[1] ?? literal[2]!)
      else if (this.exec(EMPTY_CHILD)) continue
      else if (this.source[this.at] === "{") {
        flush()
        this.container()
      } else if (this.source[this.at + 1] === "/") {
        flush()
        this.tokens.push(`</${(this.exec(JSX_CLOSING) ?? fail())[1]}>`)
        return
      } else {
        flush()
        if (!this.opensJsx()) fail()
        this.element()
      }
    }
  }
}

/**
 * Drops what formatters add or remove: semicolons, trailing commas, parentheses around JSX, around a
 * whole `return` value, arrow body, assigned value or spread, around a ternary's branch, and around an
 * arrow's one parameter, a type's leading `|` or `&`; and writes an object key that needs no quotes
 * without them.
 */
function tidy(tokens: string[], elements: [number, number][]): string[] {
  // Semicolons and trailing commas first, so that `(\n  value,\n) =>` is an arrow's one parameter.
  const moved: number[] = []
  const bare: string[] = []
  tokens.forEach((token, index) => {
    moved[index] = bare.length
    if (
      token === ";" ||
      (token === "," && /^[)\]}>]$/.test(tokens[index + 1]!))
    )
      return
    bare.push(token)
  })
  const jsx = new Set(
    elements.map(([start, end]) => `${moved[start]}:${moved[end]}`)
  )
  const dropped = new Set<number>()
  const open: number[] = []
  bare.forEach((token, index) => {
    if (token === "(") open.push(index)
    if (token !== ")") return
    const start = open.pop()!
    const before = bare[start - 1]
    const after = bare[index + 1]
    const last =
      after === undefined ||
      AFTER_WHOLE.has(after) ||
      (/^[A-Za-z_$]/.test(after) && !OPERATOR_WORDS.has(after))
    const inner = bare.slice(start + 1, index)
    const whole = WHOLE_AFTER.has(before!) && inner[0] !== "{" && last
    const branch = (before === "?" || before === ":") && last
    const parameter =
      inner.length === 1 && NAME.test(inner[0]!) && after === "=>"
    if (jsx.has(`${start + 1}:${index - 1}`) || whole || branch || parameter)
      dropped.add(start).add(index)
  })
  const result: string[] = []
  bare.forEach((token, index) => {
    if (dropped.has(index)) return
    const before = result.at(-1)!
    if ((token === "|" || token === "&") && BEFORE_TYPE.has(before)) return
    // A key starts a member: after `{`, `,`, or the member before, whose `;` is dropped or optional.
    const colon = bare[index + (bare[index + 1] === "?" ? 2 : 1)]
    const member =
      before === "{" ||
      before === "," ||
      (ENDS_EXPRESSION.test(before) && !BEFORE_EXPRESSION.has(before))
    if (isString(token) && colon === ":" && member) {
      const key = JSON.parse(token) as string
      if (NAME.test(key)) token = key
    }
    result.push(token)
  })
  return result
}

/** An import's named bindings, sorted. */
function sortNames(statement: string[]): string[] {
  const open = statement.indexOf("{")
  if (open < 0) return statement
  const close = statement.indexOf("}", open)
  const names: string[][] = [[]]
  for (const token of statement.slice(open + 1, close))
    if (token === ",") names.push([])
    else names.at(-1)!.push(token)
  return [
    ...statement.slice(0, open + 1),
    names
      .map((name) => name.join(" "))
      .sort()
      .join(" , "),
    ...statement.slice(close),
  ]
}

/** The module's top-level imports first, sorted, as Biome, Oxfmt and import-sorting plugins sort them. */
function sortImports(tokens: string[]): string[] {
  const imports: string[] = []
  const rest: string[] = []
  let depth = 0
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    const next = tokens[index + 1]
    if (depth === 0 && token === "import" && next !== "(" && next !== ".") {
      let end = index + 1
      while (
        end < tokens.length &&
        !(
          isString(tokens[end]) &&
          (end === index + 1 || tokens[end - 1] === "from")
        )
      )
        end++
      imports.push(sortNames(tokens.slice(index, end + 1)).join(" "))
      index = end
      continue
    }
    if (token === "{" || token === "(" || token === "[" || token === "${")
      depth++
    if (token === "}" || token === ")" || token === "]") depth--
    rest.push(token)
  }
  return [...imports.sort(), ...rest]
}

/** Script tokens from `at`, tidied: to the end, or to the `close` that closes the one before. */
function script(
  source: string,
  jsx: boolean,
  at = 0,
  close?: string
): { tokens: string[]; at: number } {
  const reader = new Script(source, jsx, at)
  reader.code(close)
  return { tokens: tidy(reader.tokens, reader.elements), at: reader.at }
}

const scriptModule = (source: string, jsx: boolean) =>
  sortImports(script(source, jsx).tokens)

const CSS_NUMBER = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y
const CSS_UNIT = /[A-Za-z%]+/y
const CSS_WORD = /-{0,2}[A-Za-z_\u0080-\uffff][\w\u0080-\uffff-]*/y
const CSS_NAME = /[\w\u0080-\uffff-]*/y
const CSS_DOUBLE = /"(?:[^"\\]|\\[\s\S])*"/y
const CSS_SINGLE = /'(?:[^'\\]|\\[\s\S])*'/y
/** Tokens whitespace around means nothing beside. */
const CSS_TIGHT = new Set([
  "{",
  "}",
  ";",
  ":",
  ",",
  ">",
  "+",
  "~",
  "(",
  ")",
  "=",
  "!",
  "/",
])

/**
 * CSS into tokens: a space only where whitespace separates two words (`a .b`), strings by value, an
 * unquoted `url()` or attribute value as a string, numbers by value, no `;` before `}`. With
 * `lineComments`, SCSS's and Less's `//` comments too.
 */
function style(source: string, lineComments: boolean): string[] {
  const tokens: string[] = []
  let at = 0
  let spaced = false
  let brackets = 0
  const match = (pattern: RegExp) => {
    pattern.lastIndex = at
    const found = pattern.exec(source)?.[0]
    if (found !== undefined) at += found.length
    return found
  }
  const push = (token: string) => {
    const last = tokens.at(-1)
    if (
      spaced &&
      last !== undefined &&
      !CSS_TIGHT.has(last) &&
      !CSS_TIGHT.has(token)
    )
      tokens.push(" ")
    spaced = false
    tokens.push(token)
  }
  while (at < source.length) {
    const char = source[at]!
    if (/\s/.test(char)) {
      at++
      spaced = true
    } else if (source.startsWith("/*", at)) {
      const end = source.indexOf("*/", at + 2)
      at = end < 0 ? fail() : end + 2
      spaced = true
    } else if (lineComments && source.startsWith("//", at)) {
      const end = source.indexOf("\n", at)
      at = end < 0 ? source.length : end
      spaced = true
    } else if (char === '"' || char === "'") {
      const raw = match(char === '"' ? CSS_DOUBLE : CSS_SINGLE) ?? fail()
      push(JSON.stringify(raw.slice(1, -1).replace(/\\(["'])/g, "$1")))
    } else if (/\d/.test(char) || /^\.\d/.test(source.slice(at, at + 2))) {
      const number = String(Number(match(CSS_NUMBER)))
      push(number + (match(CSS_UNIT) ?? ""))
    } else if (char === "#") {
      at++
      push(`#${match(CSS_NAME)}`)
    } else {
      const word = match(CSS_WORD)
      if (word === undefined) {
        at++
        if (char === "[") brackets++
        if (char === "]") brackets--
        push(char)
      } else if (brackets > 0 && tokens.at(-1) === "=")
        push(JSON.stringify(word))
      else if (/^url$/i.test(word) && /^\(\s*[^\s"']/.test(source.slice(at))) {
        const close = source.indexOf(")", at)
        if (close < 0) fail()
        push(word)
        push("(")
        push(JSON.stringify(source.slice(at + 1, close).trim()))
        push(")")
        at = close + 1
      } else push(word)
    }
  }
  return tokens.filter(
    (token, index) =>
      token !== ";" ||
      !(tokens[index + 1] === undefined || /^[;}]$/.test(tokens[index + 1]!))
  )
}

type Flavour = "vue" | "svelte" | "astro" | "angular"

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
])
/** An attribute whose value is an expression: Vue's directives, Angular's bindings. */
const DIRECTIVE: Record<Flavour, RegExp> = {
  vue: /^(?::|@|#|v-)/,
  angular: /^(?:\[|\(|\*|bind-|on-)/,
  svelte: /^$/,
  astro: /^$/,
}

/**
 * A component's markup into tokens: tags and attributes, each value a string or an expression read
 * as script, text with its whitespace collapsed, comments dropped, and each script and style block
 * read as its kind. Svelte and Astro write expressions in `{…}`, Vue and Angular in `{{…}}` and in
 * their directives' values; an Astro file's frontmatter is a module.
 */
function markup(source: string, flavour: Flavour): string[] {
  const tokens: string[] = []
  const braces = flavour === "svelte" || flavour === "astro"
  const jsx = flavour === "astro"
  let at = 0
  const exec = (pattern: RegExp) => {
    pattern.lastIndex = at
    const found = pattern.exec(source)
    if (found) at += found[0].length
    return found
  }
  const space = () => exec(/\s*/y)
  /** `{…}` from `from`, the `{` before it, as script, then past its `}`. */
  const expression = (text: string, from: number) => {
    const read = script(text, jsx, from, "}")
    return { tokens: ["{", ...read.tokens, "}"], at: read.at + 1 }
  }
  const value = (name: string, body: string): string[] => {
    if (
      DIRECTIVE[flavour].test(name) ||
      (flavour === "vue" && name === "generic")
    )
      return ["{", ...script(body, false).tokens, "}"]
    if (name === "style") return ["{", ...style(body, false), "}"]
    if (!braces || !body.includes("{")) return [JSON.stringify(body)]
    const parts: string[] = []
    let from = 0
    while (from < body.length) {
      const open = body.indexOf("{", from)
      const end = open < 0 ? body.length : open
      if (end > from) parts.push(JSON.stringify(body.slice(from, end)))
      if (open < 0) break
      const read = expression(body, open + 1)
      parts.push(...read.tokens)
      from = read.at
    }
    return parts
  }
  const tag = () => {
    const name = exec(/<([A-Za-z!][^\s/>]*)/y)![1]!
    const lower = name.toLowerCase()
    const attributes: Record<string, string> = {}
    tokens.push(`<${name}`)
    for (;;) {
      space()
      if (source.startsWith("/>", at)) {
        at += 2
        tokens.push(VOID.has(lower) ? ">" : "/>")
        return
      }
      if (source[at] === ">") break
      if (braces && source[at] === "{") {
        const read = expression(source, at + 1)
        tokens.push(...read.tokens)
        at = read.at
        continue
      }
      const attribute = exec(/[^\s"'>/=]+/y)?.[0] ?? fail()
      tokens.push(attribute)
      space()
      if (source[at] !== "=") continue
      at++
      space()
      if (braces && source[at] === "{") {
        const read = expression(source, at + 1)
        // `name={name}` is `{name}`, as Svelte's formatter writes it.
        if (read.tokens.length === 3 && read.tokens[1] === attribute)
          tokens.pop()
        tokens.push(...read.tokens)
        at = read.at
        continue
      }
      const quoted = exec(/"([^"]*)"|'([^']*)'|([^\s"'>]+)/y) ?? fail()
      const body = (quoted[1] ?? quoted[2] ?? quoted[3]!).replace(
        /\r\n?/g,
        "\n"
      )
      attributes[attribute] = body
      tokens.push(...value(attribute, body))
    }
    at++
    tokens.push(">")
    if (lower !== "script" && lower !== "style") return
    const end = source.toLowerCase().indexOf(`</${lower}`, at)
    if (end < 0) fail()
    const body = source.slice(at, end)
    const lang = attributes.lang ?? ""
    tokens.push(
      ...(lower === "script"
        ? scriptModule(body, lang.endsWith("x"))
        : style(body, /^(?:scss|less)$/.test(lang)))
    )
    at = end
  }
  if (flavour === "astro") {
    const front = exec(/\s*---\r?\n([\s\S]*?)\r?\n---/y)
    if (front) tokens.push("---", ...scriptModule(front[1]!, false), "---")
  }
  while (at < source.length) {
    if (source.startsWith("<!--", at)) {
      const end = source.indexOf("-->", at)
      at = end < 0 ? fail() : end + 3
    } else if (source.startsWith("</", at)) {
      const closing = exec(/<\/\s*([^\s<>]+)\s*>/y) ?? fail()
      tokens.push(`</${closing[1]}>`)
    } else if (/^<[A-Za-z!]/.test(source.slice(at, at + 2))) tag()
    else if (braces && source[at] === "{") {
      // Svelte's blocks: `{#if …}`, `{:else}`, `{/if}`, `{@html …}`.
      const sigil = exec(/\{\s*([#:/@][\w-]*)/y)
      const read = sigil
        ? script(source, jsx, at, "}")
        : script(source, jsx, at + 1, "}")
      tokens.push(sigil ? `{${sigil[1]}` : "{", ...read.tokens, "}")
      at = read.at + 1
    } else if (flavour === "angular" && /^@\w/.test(source.slice(at, at + 2))) {
      // Angular's control flow: `@if (…) {`, `@for (…; track …) {`, `@else {`, `}`.
      tokens.push(`@${exec(/@(\w+(?:\s+if\b)?)/y)![1]!.replace(/\s+/, " ")}`)
      space()
      if (source[at] === "(") {
        const read = script(source, false, at + 1, ")")
        tokens.push("(", ...read.tokens, ")")
        at = read.at + 1
        space()
      }
      if (source[at] === "{") {
        at++
        tokens.push("{")
      }
    } else if (flavour === "angular" && source[at] === "}") {
      at++
      tokens.push("}")
    } else if (!braces && source.startsWith("{{", at)) {
      const end = source.indexOf("}}", at + 2)
      if (end < 0) fail()
      tokens.push(
        "{{",
        ...script(source.slice(at + 2, end), false).tokens,
        "}}"
      )
      at = end + 2
    } else {
      const next = searchFrom(
        source,
        braces ? /[<{]/g : flavour === "angular" ? /<|\{\{|@\w|\}/g : /<|\{\{/g,
        at + 1
      )
      const end = next < 0 ? source.length : next
      const text = source.slice(at, end).replace(/\s+/g, " ").trim()
      if (text) tokens.push(`#${JSON.stringify(text)}`)
      at = end
    }
  }
  return tokens
}

/** How each kind of file is read, by its extension. */
const KINDS = new Map<string, (content: string) => string[]>([
  ...["ts", "mts", "cts"].map(
    (extension) =>
      [extension, (content: string) => scriptModule(content, false)] as const
  ),
  ...["tsx", "jsx", "js", "mjs", "cjs"].map(
    (extension) =>
      [extension, (content: string) => scriptModule(content, true)] as const
  ),
  ...["json", "jsonc", "json5"].map(
    (extension) =>
      [extension, (content: string) => script(content, false).tokens] as const
  ),
  ...["css", "pcss", "postcss"].map(
    (extension) =>
      [extension, (content: string) => style(content, false)] as const
  ),
  ...["scss", "less"].map(
    (extension) =>
      [extension, (content: string) => style(content, true)] as const
  ),
  ...(["vue", "svelte", "astro"] as const).map(
    (extension) =>
      [extension, (content: string) => markup(content, extension)] as const
  ),
  ["html", (content: string) => markup(content, "angular")],
])

/** The file's code with its formatting set aside, or none for a kind or a text it cannot read. */
export function codeOf(file: string, content: string): string | undefined {
  const read = KINDS.get(/\.([^./\\]+)$/.exec(file)?.[1]?.toLowerCase() ?? "")
  if (read === undefined) return undefined
  try {
    return read(content).join("\n")
  } catch {
    return undefined
  }
}

/** The hash of the file's code (`code` in the lockfile), or none when it has no form. */
export function codeHash(file: string, content: string): string | undefined {
  const code = codeOf(file, content)
  return code === undefined ? undefined : hashOf(code)
}

/** Whether two texts of a file are the same code, however each is formatted. */
export function sameCode(file: string, one: string, other: string): boolean {
  if (one === other) return true
  const code = codeOf(file, one)
  return code !== undefined && code === codeOf(file, other)
}

/**
 * How the project's file stands against what was installed, by the lockfile's hashes: as written,
 * reformatted (its `code` hash, else the same code as `installed`, the text installing writes now
 * when it is exactly what was written), or changed.
 */
export function againstInstalled(
  file: string,
  current: string,
  was: { written: string; code?: string },
  installed?: string
): "same" | "reformatted" | "changed" {
  if (hashOf(current) === was.written) return "same"
  if (was.code !== undefined && codeHash(file, current) === was.code)
    return "reformatted"
  if (
    installed !== undefined &&
    hashOf(installed) === was.written &&
    sameCode(file, current, installed)
  )
    return "reformatted"
  return "changed"
}
