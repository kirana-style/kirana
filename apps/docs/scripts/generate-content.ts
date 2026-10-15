/**
 * Regenerates the docs content: `bun run generate:content`, or `--check` in CI.
 * The engine is `@workspace/docs-core`; this file only says where Kirana's
 * content lives and how its `llms.txt` introduces the project.
 */
import { generate } from "@workspace/docs-core/generate.ts"

import { FACTS } from "../src/data/facts.ts"

import type { GuideGroup } from "../src/data/frameworks.ts"
import { frameworksMarkdown, guidesMarkdown } from "../src/data/frameworks.ts"
import { shortcutsMarkdown } from "../src/data/shortcuts.ts"
import {
  editorsMarkdown,
  lintRulesMarkdown,
  lintersMarkdown,
} from "../src/data/tooling.ts"

import { npmStatusMarkdown } from "../src/data/npm-status.ts"

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
  },
  site: {
    url: "https://kirana.style",
    fullTitle: "Kirana documentation",
    llms: [
      "# Kirana",
      "",
      "> Styling, compiled. A compile-time styling system for the modern web: typed",
      "> styles next to your components, compiled into small, predictable CSS with no",
      "> runtime style engine.",
      "",
      "Kirana is pre-release. The `@kirana-style/*` packages are version 0.1.0 and not",
      "published to npm; the name is a working name. Pages state what is built and",
      "what is planned.",
      "",
      "## Beyond the docs",
      "",
      "- [The compiler](https://kirana.style/compiler): the build-time pipeline, and what reaches the browser",
      "- [Migrate](https://kirana.style/migrate): the Tailwind and StyleX codemods, measured on a whole codebase",
      "- [Compare](https://kirana.style/compare): runtime CSS-in-JS, StyleX, Panda CSS and Tailwind, with sources",
      "- [Ecosystem](https://kirana.style/ecosystem): every package, bundler, framework and tool, with status",
      "- [Changelog](https://kirana.style/changelog): milestones and sprints, until there are releases",
      "- [Why Kirana](https://kirana.style/why), [Open source](https://kirana.style/open-source), [License](https://kirana.style/license)",
      "",
    ],
  },
})
