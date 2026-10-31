/**
 * Regenerates the docs content: `bun run generate:content`, or `--check` in CI.
 * The engine is `@workspace/docs-core`; this file only says where Kirana's
 * content lives and how its `llms.txt` introduces the project.
 */
import { generate } from "@workspace/docs-core/generate.ts"

import { FACTS, VERSION } from "../src/data/facts.ts"
import { PLAYGROUND, SITE_URL, UI_SITE } from "../src/data/links.ts"

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
      "## Beyond the docs",
      "",
      `- [The compiler](${SITE_URL}/compiler): the build-time pipeline, and what reaches the browser`,
      `- [In your editor](${SITE_URL}/editor): what the language server shows on every element, and where it runs`,
      `- [Kirana UI](${SITE_URL}/ui): shadcn/ui's components and charts in typed styles, installed with \`kirana-style ui add\` ([its site](${UI_SITE}))`,
      `- [Migrate](${SITE_URL}/migrate): the Tailwind and StyleX codemods, measured on a whole codebase`,
      `- [Compare](${SITE_URL}/compare): runtime CSS-in-JS, StyleX, Panda CSS and Tailwind, with sources`,
      `- [Ecosystem](${SITE_URL}/ecosystem): every package, bundler, framework and tool, with status`,
      `- [Playground](${PLAYGROUND}): a project compiled in your browser by a released engine`,
      `- [Changelog](${SITE_URL}/changelog): every release and what came with it`,
      `- [Why Kirana](${SITE_URL}/why), [Open source](${SITE_URL}/open-source), [License](${SITE_URL}/license)`,
      "",
    ],
  },
})
