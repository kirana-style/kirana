/**
 * Regenerates the docs content: `bun run generate:content`, or `--check` in CI.
 * The engine is `@workspace/docs-core`; this file only says where Kirana's
 * content lives and how its `llms.txt` introduces the project.
 */
import { generate } from "@workspace/docs-core/generate.ts"

import { FACTS, VERSION } from "../src/data/facts.ts"
import { PLAYGROUND, SITE_URL, UI_PAGES, UI_SITE } from "../src/data/links.ts"

import type { GuideGroup } from "../src/data/frameworks.ts"
import { frameworksMarkdown, guidesMarkdown } from "../src/data/frameworks.ts"
import { shortcutsMarkdown } from "../src/data/shortcuts.ts"
import {
  editorsMarkdown,
  lintRulesMarkdown,
  lintersMarkdown,
} from "../src/data/tooling.ts"

import { npmStatusMarkdown } from "../src/data/npm-status.ts"
import { productsMarkdown } from "../src/data/products.ts"
import { roadmapMarkdown } from "../src/data/roadmap.ts"
import { benchmarksMarkdown } from "../src/data/benchmarks.ts"

await generate({
  root: new URL("..", import.meta.url).pathname,
  typesImport: "@/lib/content",
  generatedBy: "scripts/generate-content.ts",
  regenerateCommand: "bun run generate:content",
  check: process.argv.includes("--check"),
  facts: FACTS,
  plain: {
    frameworks: frameworksMarkdown,
    guides: ({ group }) => guidesMarkdown(group as GuideGroup | undefined),
    // Tabs are for the page; the twin reads every panel in order, under its heading.
    start: () => "",
    end: () => "",
    "docs-shortcuts": shortcutsMarkdown,
    editors: editorsMarkdown,
    linters: lintersMarkdown,
    "lint-rules": lintRulesMarkdown,
    "npm-status": ({ kind }) => npmStatusMarkdown(kind),
    roadmap: roadmapMarkdown,
    products: productsMarkdown,
    benchmarks: benchmarksMarkdown,
  },
  site: {
    url: SITE_URL,
    fullTitle: "Kirana documentation",
    llms: [
      "# Kirana",
      "",
      "> Styling, compiled. A compile-time styling system for the modern web: typed",
      "> styles next to your components, compiled into small, predictable CSS with no",
      "> runtime style engine.",
      "",
      `Kirana is on npm: the \`@kirana-style/*\` packages are at ${VERSION}, and`,
      "`npx kirana-style@latest init` sets a project up. Before 1.0, a minor version may",
      "change the API. Pages state what is built and what is planned.",
      "",
      "## Before writing styles",
      "",
      "- Install the agent skills: `npx skills add kirana-style/kirana`. They carry the rules, the",
      "  loop below, every diagnostic with what to do about it, and how to build and publish a design",
      `  system (${FACTS.skills}).`,
      "- Styles are `css({ ... })` handles from `@kirana-style/core`, passed to `sx`. There is no `cn`",
      "  and no `class-variance-authority`, and no utility-class strings unless the project turns on",
      "  the scales preset's utilities.",
      '- Conditions go inside the value: `color: { base: a, ":hover": b }`.',
      "- Dark mode is a `light-dark()` pair on the token; there is no `dark:` variant.",
      "- A later style replaces the entries it names and keeps the rest.",
      "",
      "## The loop",
      "",
      "1. `kirana-style export` lists the tokens, themes, recipes and relations that exist, each with",
      "   the file and line that declares it: use those names.",
      "2. After writing styles, `kirana-style check <paths> --format json`, and fix each error by its",
      `   code ([the diagnostics](${SITE_URL}/docs/tooling/diagnostics.md)). A misspelt property,`,
      "   condition or token and a length without its unit are errors; a word in a property that also",
      "   takes names of your own is accepted.",
      "3. When a style compiles and looks wrong, `kirana-style trace <file>:<line> <property>` names",
      "   the entry that wins and the step of the precedence ladder that decided it.",
      "",
      "## Beyond the docs",
      "",
      `- [The compiler](${SITE_URL}/compiler): the build-time pipeline, and what reaches the browser`,
      `- [In your editor](${SITE_URL}/editor): what the language server shows on every element, and where it runs`,
      `- [Kirana UI](${SITE_URL}/ui): shadcn/ui's design system, on your framework and your headless library, installed with \`kirana-style ui add\` ([its site](${UI_SITE}))`,
      `- [Kirana UI Primitives](${UI_PAGES.primitives}): headless parts that are the same on every framework, checked state by state; a library of their own, which Kirana UI uses as one of its bases`,
      `- [Migrate](${SITE_URL}/migrate): codemods for Tailwind, StyleX, CSS Modules and styled-components or Emotion; the Tailwind one measured on a whole codebase`,
      `- [Compare](${SITE_URL}/compare): runtime CSS-in-JS, StyleX, Panda CSS and Tailwind, with sources`,
      `- [Ecosystem](${SITE_URL}/ecosystem): every package, bundler, framework and tool, with status`,
      `- [Playground](${PLAYGROUND}): a project compiled in your browser by a released engine`,
      `- [Changelog](${SITE_URL}/changelog): every release and what came with it`,
      `- [Why Kirana](${SITE_URL}/why), [Open source](${SITE_URL}/open-source), [License](${SITE_URL}/license)`,
      "",
    ],
  },
})
