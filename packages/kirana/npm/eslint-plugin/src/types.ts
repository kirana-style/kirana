/**
 * The slice of the ESLint rule API the rules use. Oxlint's JS plugins implement the same API
 * (`jsPlugins`), so one rule object serves both linters without depending on either package.
 */

/** An ESTree node, loosely typed: rules check `type` before reading fields. */
export type Node = {
  type: string
  range: [number, number]
  parent?: Node | null
  [field: string]: any
}

export type Fix = { range: [number, number]; text: string }

export type Fixer = {
  replaceText: (node: Node, text: string) => Fix
  replaceTextRange: (range: [number, number], text: string) => Fix
  insertTextBeforeRange: (range: [number, number], text: string) => Fix
}

export type Location = { line: number; column: number }

export type Report = {
  message: string
  node?: Node
  loc?: { start: Location; end: Location }
  fix?: (fixer: Fixer) => Fix | Fix[] | null
  suggest?: Array<{ desc: string; fix: (fixer: Fixer) => Fix | Fix[] | null }>
}

export type Context = {
  filename: string
  cwd: string
  options: readonly unknown[]
  settings: Record<string, unknown>
  sourceCode: {
    text: string
    ast: Node
    getText: (node?: Node) => string
    getLocFromIndex: (index: number) => Location
  }
  report: (report: Report) => void
}

export type Rule = {
  meta: {
    type: "problem" | "suggestion" | "layout"
    docs: { description: string; url: string }
    fixable?: "code"
    hasSuggestions?: boolean
    schema: unknown[]
  }
  create: (context: Context) => Record<string, (node: Node) => void>
}

/** The documentation page of a rule. */
export const docs = (rule: string) =>
  `https://kirana.style/docs/tooling/lint#${rule}`
