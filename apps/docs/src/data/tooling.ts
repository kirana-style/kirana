/**
 * The editors and linters the tooling pages offer, and the lint rules. Plain data, so the
 * markdown twin (`scripts/generate-content.ts`) lists the same entries as the cards.
 */

export type ToolChoice = {
  /** A key into the SVGL logos, when the tool has one. */
  logo?: string
  title: string
  /** How it is set up, in a few words. */
  how: string
  href: string
}

const EDITOR = "/docs/tooling/editor"
const LINT = "/docs/tooling/lint"

export const EDITORS: readonly ToolChoice[] = [
  {
    logo: "vscode",
    title: "VS Code",
    how: "Extension",
    href: `${EDITOR}#vs-code-and-its-forks`,
  },
  {
    logo: "cursor",
    title: "Cursor",
    how: "VS Code extension",
    href: `${EDITOR}#vs-code-and-its-forks`,
  },
  {
    logo: "windsurf",
    title: "Windsurf",
    how: "VS Code extension",
    href: `${EDITOR}#vs-code-and-its-forks`,
  },
  {
    logo: "antigravity",
    title: "Antigravity",
    how: "VS Code extension",
    href: `${EDITOR}#vs-code-and-its-forks`,
  },
  { logo: "zed", title: "Zed", how: "Extension", href: `${EDITOR}#zed` },
  {
    logo: "neovim",
    title: "Neovim",
    how: "vim.lsp.config",
    href: `${EDITOR}#neovim`,
  },
  {
    logo: "helix",
    title: "Helix",
    how: "languages.toml",
    href: `${EDITOR}#helix`,
  },
  {
    title: "Any LSP editor",
    how: "kirana lsp over stdio",
    href: `${EDITOR}#any-other-editor`,
  },
]

export const LINTERS: readonly ToolChoice[] = [
  { logo: "oxc", title: "Oxlint", how: "jsPlugins", href: `${LINT}#oxlint` },
  {
    logo: "eslint",
    title: "ESLint",
    how: "Flat config",
    href: `${LINT}#eslint`,
  },
  {
    logo: "biome",
    title: "Biome",
    how: "GritQL plugins",
    href: `${LINT}#biome`,
  },
]

export type LintRule = {
  name: string
  config: "recommended" | "strict"
  fix?: "autofix" | "suggestions"
  /** Also a Biome GritQL plugin (`@kirana-style/biome-plugin`). */
  biome?: boolean
  catches: string
}

export const LINT_RULES: readonly LintRule[] = [
  {
    name: "diagnostics",
    config: "recommended",
    catches: "Every compiler diagnostic, at the property",
  },
  {
    name: "sx-last",
    config: "recommended",
    fix: "autofix",
    biome: true,
    catches: "A forwarded sx that callers cannot override",
  },
  {
    name: "no-conflicting-props",
    config: "recommended",
    biome: true,
    catches: "className or style beside a styleProps() spread",
  },
  {
    name: "override-keeps-conditions",
    config: "recommended",
    fix: "suggestions",
    catches: "A plain override that loses under [data-*]",
  },
  {
    name: "no-classname-on-sx",
    config: "recommended",
    catches: "A class that never reaches the DOM",
  },
  {
    name: "no-unused",
    config: "recommended",
    fix: "suggestions",
    catches: "Styles and recipe options nothing applies",
  },
  {
    name: "no-dark-variant",
    config: "recommended",
    biome: true,
    catches: "Dark mode the page's chosen mode never reaches",
  },
  {
    name: "sort-properties",
    config: "strict",
    fix: "autofix",
    catches: "Property and condition order",
  },
  {
    name: "prefer-token",
    config: "strict",
    fix: "suggestions",
    catches: "A literal that repeats a token",
  },
  {
    name: "finite-bridge",
    config: "strict",
    catches: "A runtime value that is really a variant",
  },
  {
    name: "no-class-helpers",
    config: "strict",
    biome: true,
    catches: "clsx, tailwind-merge or cva joining class strings",
  },
]

const list = (choices: readonly ToolChoice[]) =>
  choices
    .map((choice) => `- [${choice.title}](${choice.href}): ${choice.how}`)
    .join("\n")

export const editorsMarkdown = () => list(EDITORS)
export const lintersMarkdown = () => list(LINTERS)
export const lintRulesMarkdown = () =>
  LINT_RULES.map(
    (rule) =>
      `- [\`kirana/${rule.name}\`](${LINT}#${rule.name}) (${rule.config}${rule.fix ? `, ${rule.fix}` : ""}${rule.biome ? ", also Biome" : ""}): ${rule.catches}`
  ).join("\n")
