/**
 * The /compare matrix. Every cell carries the page it is taken from — the
 * tool's own documentation, or this site's for Kirana and for the measured
 * StyleX port. A cell with nothing sourced says so rather than guessing.
 * Checked 2026-09-29; the editor, lint, migration and agent rows 2026-10-05;
 * Panda against 2.2.0, and the fallback, anchor, view-transition, bug-report,
 * agent-skill, design-system and CI rows, 2026-10-12.
 */
import { RUNTIME_SIZE } from "@/data/benchmarks"
import { COUNTS, LISTS, sentence } from "@/data/facts"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"
import type { SVGL } from "@/generated/svgl-icons.gen"

/** A brand logo, by its key in the generated map. */
export type Brand = keyof typeof SVGL

export type Tool = "runtime" | "stylex" | "panda" | "tailwind" | "kirana"

/** Each tool's name, and one line on what kind of tool it is. */
/**
 * Each tool's name, one line on what kind of tool it is, and its logo (svgl.app, then
 * LogoForge). Kirana shows its own. A column that is a kind of tool rather than one product
 * (runtime CSS-in-JS) has no logo, since no one product's mark stands for it.
 */
export const TOOLS: readonly {
  id: Tool
  name: string
  note: string
  logo?: Brand
}[] = [
  { id: "kirana", name: "Kirana", note: "Compiled CSS-in-JS" },
  { id: "stylex", name: "StyleX", note: "Compiled atomic CSS", logo: "stylex" },
  {
    id: "panda",
    name: "Panda CSS",
    note: "Build-time CSS-in-JS",
    logo: "pandacss",
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    note: "Utility classes, v4",
    logo: "tailwindcss",
  },
  {
    id: "runtime",
    name: "Runtime CSS-in-JS",
    note: "Emotion, styled-components",
  },
]

export type Cell = {
  /** One to three words for the table: the verdict at a glance. */
  short: string
  /** good: helps you; bad: costs you; neutral: a design choice. */
  tone: "good" | "bad" | "neutral" | "none"
  /** The full statement, shown with its source under the table. */
  text: string
  /** Where the statement comes from; absent only for "not compared". */
  source?: string
  /** The editors, linters or frameworks the cell names, shown as their logos. */
  brands?: readonly Brand[]
}

export type Row = {
  topic: string
  /** The question in plain words, for someone new to all five tools. */
  help: string
  cells: Record<Tool, Cell>
}

const WHY = "/docs/start/why-kirana"
const HOW = "/docs/start/how-it-works"
const STYLEX = "https://stylexjs.com/docs/learn/"
const PANDA = "https://panda-css.com/docs/overview/why-panda"
const PANDA_CONDITIONS =
  "https://panda-css.com/docs/concepts/conditional-styles"
const TW_DETECT =
  "https://tailwindcss.com/docs/detecting-classes-in-source-files"
const TW_STATES = "https://tailwindcss.com/docs/hover-focus-and-other-states"
const TW_DARK = "https://tailwindcss.com/docs/dark-mode"
const EMOTION = "https://emotion.sh/docs/object-styles"
const STYLEX_PACKAGES =
  "https://github.com/facebook/stylex/tree/main/packages/%40stylexjs"
const STYLEX_ESLINT =
  "https://stylexjs.com/docs/api/configuration/eslint-plugin/"
const TW_EDITOR = "https://tailwindcss.com/docs/editor-setup"
const TW_FRAMEWORKS =
  "https://tailwindcss.com/docs/installation/framework-guides"
const PANDA_FRAMEWORKS = "https://panda-css.com/docs/overview/getting-started"
const PANDA_V2 = "https://panda-css.com/blog/panda-css-v2"
const PANDA_DIAGNOSTICS = "https://panda-css.com/docs/reference/diagnostics"
const PANDA_LINT = "https://panda-css.com/docs/get-started/linting"
const PANDA_CHANGELOG =
  "https://github.com/chakra-ui/panda/blob/main/CHANGELOG.md"
const PANDA_STYLEX = "https://panda-css.com/docs/get-started/stylex"
const PANDA_CLI = "https://panda-css.com/docs/reference/cli"
const PANDA_FALLBACKS = "https://panda-css.com/docs/styling/first-that-works"
const PANDA_POSITION_TRY = "https://panda-css.com/docs/styling/position-try"
const PANDA_VIEW_TRANSITION =
  "https://panda-css.com/docs/styling/view-transition"
const STYLEX_API = "https://stylexjs.com/docs/api/javascript"
const PANDA_SKILLS = "https://github.com/chakra-ui/panda/tree/main/skills"
const PANDA_SPEC = "https://panda-css.com/docs/theming/json-spec"
const PANDA_WRITING = "https://panda-css.com/docs/concepts/writing-styles"
const STYLEX_WHEN = "https://stylexjs.com/docs/api/javascript/when/"
const STYLEX_ESLINT_RULES =
  "https://github.com/facebook/stylex/tree/main/packages/%40stylexjs/eslint-plugin"

const none: Cell = {
  short: "Not compared",
  tone: "none",
  text: "Not compared here",
}

export const ROWS: readonly Row[] = [
  {
    topic: "When CSS is produced",
    help: "Does styling work happen on your users' devices?",
    cells: {
      runtime: {
        short: "In the browser",
        tone: "bad",
        text: "In the browser, while components render",
        source: WHY,
      },
      stylex: {
        short: "At build",
        tone: "good",
        text: "At compile time, as a static CSS file",
        source: STYLEX,
      },
      panda: {
        short: "At build",
        tone: "good",
        text: "At build time, by a Rust compiler (Oxc) run from its CLI, Vite or PostCSS",
        source: PANDA_V2,
      },
      tailwind: {
        short: "At build",
        tone: "good",
        text: "At build time, for class names found by scanning source as text",
        source: TW_DETECT,
      },
      kirana: {
        short: "At build",
        tone: "good",
        text: "At build time, by a compiler that evaluates the styles",
        source: HOW,
      },
    },
  },
  {
    topic: "Styles injected at runtime",
    help: "Does a script add <style> tags while the page runs?",
    cells: {
      runtime: {
        short: "Yes",
        tone: "bad",
        text: "Yes, <style> tags",
        source: WHY,
      },
      stylex: {
        short: "No",
        tone: "good",
        text: "No runtime style injection",
        source: STYLEX,
      },
      panda: {
        short: "No",
        tone: "good",
        text: "No; a lightweight runtime joins key–value pairs into classes, and an opt-in transform compiles static calls away",
        source: PANDA_V2,
      },
      tailwind: {
        short: "No",
        tone: "good",
        text: "No; class strings, often merged at runtime with twMerge",
        source: WHY,
      },
      kirana: {
        short: "No",
        tone: "good",
        text: `Never. Static styles import nothing; merging and bridging use a helper under ${RUNTIME_SIZE}`,
        source: WHY,
      },
    },
  },
  {
    topic: "Shape of the CSS",
    help: "What the stylesheet you ship looks like.",
    cells: {
      runtime: {
        short: "A rule per usage",
        tone: "neutral",
        text: "Often one rule per usage",
        source: WHY,
      },
      stylex: {
        short: "Atomic",
        tone: "good",
        text: "Atomic, collision-free",
        source: STYLEX,
      },
      panda: { short: "Atomic", tone: "good", text: "Atomic", source: PANDA },
      tailwind: {
        short: "A rule per utility",
        tone: "neutral",
        text: "One rule per utility class found",
        source: TW_DETECT,
      },
      kirana: {
        short: "Atomic",
        tone: "good",
        text: "Atomic: one rule per distinct declaration",
        source: HOW,
      },
    },
  },
  {
    topic: "Where a hover goes",
    help: "How you write a hover style.",
    cells: {
      runtime: {
        short: "Nested selector",
        tone: "neutral",
        text: "A nested selector: '&:hover': { … }",
        source: EMOTION,
      },
      stylex: {
        short: "In the value",
        tone: "neutral",
        text: "Inside the value: { default, ':hover' }",
        source: "/docs/migration/from-stylex",
      },
      panda: {
        short: "In the value",
        tone: "neutral",
        text: "Inside the value: { base, _hover }",
        source: PANDA_CONDITIONS,
      },
      tailwind: {
        short: "Class prefix",
        tone: "neutral",
        text: "A prefix on the class: hover:bg-…",
        source: TW_STATES,
      },
      kirana: {
        short: "In the value",
        tone: "neutral",
        text: "Inside the value: { base, ':hover' }",
        source: "/docs/styling/conditions",
      },
    },
  },
  {
    topic: "Headless component states",
    help: "How you style a part's state from a headless library: checked, open, the side a popup opened on.",
    cells: {
      runtime: {
        short: "Selector strings",
        tone: "neutral",
        text: "A nested selector string: '&…': { … }",
        source: EMOTION,
      },
      stylex: {
        short: "Attribute selectors",
        tone: "neutral",
        text: "Attribute selectors such as '[data-state=\"open\"]', in stylex.when on a marked element",
        source: STYLEX_WHEN,
      },
      panda: {
        short: "Built-in conditions",
        tone: "good",
        text: 'Conditions such as _checked and _open, each matching several conventions ([data-checked], [data-state="checked"]); other states as selector strings',
        source: PANDA_CONDITIONS,
      },
      tailwind: {
        short: "data-* variants",
        tone: "neutral",
        text: "data-* and aria-* variants in class names: data-checked:, data-[size=large]:",
        source: TW_STATES,
      },
      kirana: {
        short: "Typed per library",
        tone: "good",
        text: "Typed keys generated from the library's own declarations (Base UI), and a few lines for any other",
        source: "/docs/styling/states",
      },
    },
  },
  {
    topic: "When two styles set one property",
    help: "What happens when you combine two styles.",
    cells: {
      runtime: none,
      stylex: {
        short: "Last one wins",
        tone: "neutral",
        text: "The last style wins for the whole property",
        source: STYLEX,
      },
      panda: none,
      tailwind: {
        short: "Source order",
        tone: "neutral",
        text: "CSS source order decides; twMerge removes conflicts it knows about",
        source: WHY,
      },
      kirana: {
        short: "Per entry",
        tone: "neutral",
        text: "The later style replaces only the entries it names",
        source: "/docs/styling/merging",
      },
    },
  },
  {
    topic: "Dark mode",
    help: "How a dark theme is written.",
    cells: {
      runtime: none,
      stylex: none,
      panda: none,
      tailwind: {
        short: "dark: variant",
        tone: "neutral",
        text: "A dark: variant on each class",
        source: TW_DARK,
      },
      kirana: {
        short: "light-dark() pair",
        tone: "neutral",
        text: "One light-dark() pair per colour; no variant",
        source: "/docs/tokens/themes-and-modes",
      },
    },
  },
  {
    topic: "Checks on your styles",
    help: "Does the tool catch styling mistakes for you?",
    cells: {
      runtime: none,
      stylex: {
        short: "Lint plugin",
        tone: "good",
        text: "A lint plugin, separate from the compiler",
        source: WHY,
      },
      panda: {
        short: "Diagnostics",
        tone: "good",
        text: "Compiler diagnostics with codes and locations, listed by panda doctor",
        source: PANDA_DIAGNOSTICS,
      },
      tailwind: none,
      kirana: {
        short: `${DIAGNOSTICS.length} diagnostics`,
        tone: "good",
        text: `${DIAGNOSTICS.length} diagnostics from the compiler itself, with stable codes`,
        source: "/docs/tooling/diagnostics",
      },
    },
  },
  {
    topic: "Invalid values caught",
    help: "Is a value the property does not take, such as padding: red, an error?",
    cells: {
      runtime: none,
      stylex: {
        short: "Lint rule",
        tone: "good",
        text: "A lint rule, no-nonstandard-styles, validates values against property specifications",
        source: STYLEX_ESLINT_RULES,
      },
      panda: {
        short: "Opt-in, some properties",
        tone: "neutral",
        text: "Opt-in strictPropertyValues rejects values outside a property's predefined list; other properties take any value",
        source: PANDA_WRITING,
      },
      tailwind: none,
      kirana: {
        short: "In the compiler",
        tone: "good",
        text: "Every value checked against its property's grammar at build, tokens included; CSS newer than the data is never rejected",
        source: "/docs/styling/styles",
      },
    },
  },
  {
    topic: "Type-checked styles",
    help: "Does your editor check property names and values?",
    cells: {
      runtime: none,
      stylex: {
        short: "Yes",
        tone: "good",
        text: "Type-safe styles and themes",
        source: STYLEX,
      },
      panda: {
        short: "Yes",
        tone: "good",
        text: "csstype plus generated typings for tokens",
        source: PANDA,
      },
      tailwind: none,
      kirana: {
        short: "Yes",
        tone: "good",
        text: "Real CSS properties and values, checked by TypeScript",
        source: "/docs/styling/styles",
      },
    },
  },
  {
    topic: "Frameworks",
    help: "Which frameworks it documents a setup for.",
    cells: {
      runtime: {
        short: "React",
        tone: "neutral",
        text: "React: Emotion's css prop and styled-components are React libraries",
        source: EMOTION,
        brands: ["react"],
      },
      stylex: {
        short: "React",
        tone: "neutral",
        text: "Used from React; its packages are a Babel plugin and bundler plugins",
        source: STYLEX_PACKAGES,
        brands: ["react"],
      },
      panda: {
        short: "Many",
        tone: "good",
        text: "Installation guides for Next.js, Nuxt, Astro, Vue, Svelte, Solid, Preact, React and more",
        source: PANDA_FRAMEWORKS,
        brands: ["react", "nextjs", "vue", "svelte", "solidjs", "astro"],
      },
      tailwind: {
        short: "Any",
        tone: "good",
        text: "Framework guides for Next.js, Nuxt, SvelteKit, Astro and more; any HTML",
        source: TW_FRAMEWORKS,
        brands: ["nextjs", "nuxt", "sveltekit", "astro"],
      },
      kirana: {
        short: `${COUNTS.frameworks + COUNTS.serverFrameworks} frameworks`,
        tone: "good",
        text: `${sentence(LISTS.frameworks)}, and server templates in ${sentence(LISTS.serverFrameworks)}, each built and checked in a browser on every change`,
        source: "/docs/frameworks/overview",
        brands: [
          "react",
          "nextjs",
          "vue",
          "svelte",
          "solidjs",
          "astro",
          "qwik",
          "angular",
        ],
      },
    },
  },
  {
    topic: "Editor support",
    help: "Does your editor show the CSS a style becomes, and catch mistakes as you type?",
    cells: {
      runtime: none,
      stylex: {
        short: "None",
        tone: "bad",
        text: "No editor extension or language server among its packages (its devtools extension is for the browser); types come from TypeScript",
        source: STYLEX_PACKAGES,
      },
      panda: {
        short: "None",
        tone: "bad",
        text: "Its TypeScript plugin and language server were discontinued in 2.1.2; types come from generated code",
        source: PANDA_CHANGELOG,
      },
      tailwind: {
        short: "IntelliSense",
        tone: "good",
        text: "The official Tailwind CSS IntelliSense extension: completion, hover previews and linting of class names",
        source: TW_EDITOR,
        brands: ["vscode"],
      },
      kirana: {
        short: "Language server",
        tone: "good",
        text: "kirana-style lsp, with VS Code and Zed extensions: the compiled CSS and the winning entry on hover, colour swatches, a summary after every sx, completion and the compiler's diagnostics as you type",
        source: "/docs/tooling/editor",
        brands: ["vscode", "cursor", "zed", "neovim"],
      },
    },
  },
  {
    topic: "Lint in your linter",
    help: "Do the styling checks run in the linter your CI already runs?",
    cells: {
      runtime: none,
      stylex: {
        short: "ESLint plugin",
        tone: "good",
        text: "@stylexjs/eslint-plugin, which re-implements validation of properties and values in JavaScript",
        source: STYLEX_ESLINT,
        brands: ["eslint"],
      },
      panda: {
        short: "ESLint + Oxlint",
        tone: "good",
        text: "@pandacss/eslint-plugin lints against the same extraction the build uses, under ESLint and Oxlint",
        source: PANDA_LINT,
        brands: ["eslint", "oxc"],
      },
      tailwind: none,
      kirana: {
        short: "Oxlint, ESLint, Biome",
        tone: "good",
        text: `@kirana-style/eslint-plugin reads the compiler instead of re-implementing it, with identical results under Oxlint and ESLint, proven by a test on every change; @kirana-style/biome-plugin carries the ${COUNTS.biomeRules} rules that need no compiler to Biome, with the same reports`,
        source: "/docs/tooling/lint",
        brands: ["oxc", "eslint", "biome"],
      },
    },
  },
  {
    topic: "Moving an existing app",
    help: "Is there a codemod from what you use today?",
    cells: {
      runtime: none,
      stylex: none,
      panda: {
        short: "A guide",
        tone: "neutral",
        text: "A written guide from StyleX, mapping each API by hand; no codemod",
        source: PANDA_STYLEX,
      },
      tailwind: none,
      kirana: {
        short: "Two codemods",
        tone: "good",
        text: "kirana-style migrate tailwind and kirana-style migrate stylex, measured on our shadcn/ui port: zero computed-style differences after the Tailwind codemod and its hand fixes",
        source: "/docs/migration/from-tailwind",
      },
    },
  },
  {
    topic: "Docs for AI agents",
    help: "Can a coding agent read the documentation whole?",
    cells: {
      runtime: none,
      stylex: none,
      panda: {
        short: "MCP server",
        tone: "good",
        text: "An MCP server, @pandacss/mcp, that answers questions about your tokens and recipes",
        source: "https://panda-css.com/docs/get-started/mcp-server",
      },
      tailwind: none,
      kirana: {
        short: "llms.txt",
        tone: "good",
        text: "llms.txt, llms-full.txt and a markdown twin of every page; and the styles themselves are plain CSS properties an agent already knows",
        source: "/docs/project/llms",
      },
    },
  },
  {
    topic: "Agent skills",
    help: "Can a coding agent install instructions for writing it?",
    cells: {
      runtime: none,
      stylex: none,
      panda: {
        short: "Three skills",
        tone: "good",
        text: "panda-css, panda-css-theming and panda-css-migrate (v1 to v2), installed with npx skills add chakra-ui/panda",
        source: PANDA_SKILLS,
      },
      tailwind: none,
      kirana: {
        short: "Two skills",
        tone: "good",
        text: "kirana and kirana-migrate (from Tailwind or StyleX), installed with npx skills add; the diagnostics and lint references in them are generated from the compiler on every build",
        source: "/docs/project/agent-skills",
      },
    },
  },
  {
    topic: "Design system as data",
    help: "Can tools read your tokens, themes and recipes without parsing your code?",
    cells: {
      runtime: none,
      stylex: none,
      panda: {
        short: "--spec",
        tone: "good",
        text: "panda codegen --spec writes design-system.json: every token, condition and theme in one file",
        source: PANDA_SPEC,
      },
      tailwind: none,
      kirana: {
        short: "kirana-style export",
        tone: "good",
        text: "kirana-style export prints tokens, themes, recipes with their variants, relations and named definitions, each with the file and line that declares it",
        source: "/docs/tooling/cli#kirana-style-export",
      },
    },
  },
  {
    topic: "Diagnostics in CI",
    help: "Can warnings fail a pull request and show up on the changed lines?",
    cells: {
      runtime: none,
      stylex: none,
      panda: {
        short: "github + max-warnings",
        tone: "good",
        text: "--format github for workflow annotations, and --max-warnings to fail on warnings",
        source: PANDA_CLI,
        brands: ["github"],
      },
      tailwind: none,
      kirana: {
        short: "github + max-warnings",
        tone: "good",
        text: "kirana-style check --format github annotates the changed lines, and --max-warnings fails the run on warnings",
        source: "/docs/tooling/cli#kirana-style-check",
        brands: ["github"],
      },
    },
  },
  {
    topic: "Fallback values",
    help: "Can one property carry a modern value and a fallback for older browsers?",
    cells: {
      runtime: {
        short: "Arrays",
        tone: "good",
        text: "An array of values writes the property once per value",
        source: EMOTION,
      },
      stylex: {
        short: "firstThatWorks",
        tone: "good",
        text: "stylex.firstThatWorks(), preferred value first",
        source: `${STYLEX_API}/firstThatWorks`,
      },
      panda: {
        short: "firstThatWorks",
        tone: "good",
        text: "firstThatWorks(), with diagnostics for malformed runs",
        source: PANDA_FALLBACKS,
      },
      tailwind: none,
      kirana: {
        short: "firstThatWorks",
        tone: "good",
        text: "firstThatWorks(): one atom per run, every value checked like a value written alone, and a run whose values set different longhands rejected",
        source: "/docs/styling/fallbacks",
      },
    },
  },
  {
    topic: "Anchor fallbacks",
    help: "Can you define where an anchored popover goes when it would overflow?",
    cells: {
      runtime: none,
      stylex: {
        short: "positionTry",
        tone: "good",
        text: "stylex.positionTry() creates an @position-try rule",
        source: `${STYLEX_API}/positionTry`,
      },
      panda: {
        short: "positionTry",
        tone: "good",
        text: "positionTry() returns the dashed ident for position-try-fallbacks",
        source: PANDA_POSITION_TRY,
      },
      tailwind: none,
      kirana: {
        short: "Checked",
        tone: "good",
        text: "positionTry(): the rule ships only where it is referenced, and a property @position-try ignores is a diagnostic",
        source: "/docs/styling/anchor-positioning",
      },
    },
  },
  {
    topic: "View transitions",
    help: "Can you style the animation between two states of a page?",
    cells: {
      runtime: none,
      stylex: {
        short: "A class",
        tone: "good",
        text: "stylex.viewTransitionClass() returns a class for the ::view-transition-* pseudo-elements",
        source: `${STYLEX_API}/viewTransitionClass`,
      },
      panda: {
        short: "A class",
        tone: "good",
        text: "viewTransition() returns a shared class; you set a unique name per element",
        source: PANDA_VIEW_TRANSITION,
      },
      tailwind: none,
      kirana: {
        short: "Class and style",
        tone: "good",
        text: "viewTransition(): one value that goes in sx and in a framework's transition prop; media() and supports() conditions per part",
        source: "/docs/styling/view-transitions",
      },
    },
  },
  {
    topic: "Bug reports",
    help: "Can the tool collect what a bug report needs?",
    cells: {
      runtime: none,
      stylex: none,
      panda: {
        short: "panda debug",
        tone: "good",
        text: "panda debug dumps the resolved config, per-file extraction results and the CSS, optionally zipped",
        source: PANDA_CLI,
      },
      tailwind: none,
      kirana: {
        short: "doctor --report",
        tone: "good",
        text: "kirana-style doctor --report writes a paste-ready issue body: versions, checks, diagnostics by code and an optional trace, with no source and no machine paths",
        source: "/docs/tooling/cli",
      },
    },
  },
]

/**
 * The questions, in groups a newcomer reads in order: what the tool ships, how you write with it,
 * what checks it, how you adopt it, and what it gives a coding agent. Every row is in exactly one
 * group; `GROUPED` throws when one is missing, so a new row cannot fall out of the table.
 */
const GROUP_TOPICS: readonly { title: string; topics: readonly string[] }[] = [
  {
    title: "What it ships",
    topics: [
      "When CSS is produced",
      "Styles injected at runtime",
      "Shape of the CSS",
    ],
  },
  {
    title: "Writing styles",
    topics: [
      "Where a hover goes",
      "Headless component states",
      "When two styles set one property",
      "Dark mode",
      "Type-checked styles",
      "Fallback values",
      "Anchor fallbacks",
      "View transitions",
    ],
  },
  {
    title: "Checks and tools",
    topics: [
      "Checks on your styles",
      "Invalid values caught",
      "Editor support",
      "Lint in your linter",
      "Diagnostics in CI",
      "Bug reports",
    ],
  },
  {
    title: "Adopting it",
    topics: ["Frameworks", "Moving an existing app", "Design system as data"],
  },
  {
    title: "For coding agents",
    topics: ["Docs for AI agents", "Agent skills"],
  },
]

export const GROUPED: readonly { title: string; rows: readonly Row[] }[] =
  (() => {
    const byTopic = new Map(ROWS.map((row) => [row.topic, row]))
    const grouped = GROUP_TOPICS.map((group) => ({
      title: group.title,
      rows: group.topics.map((topic) => {
        const row = byTopic.get(topic)
        if (!row)
          throw new Error(
            `compare: no row "${topic}" for group "${group.title}"`
          )
        byTopic.delete(topic)
        return row
      }),
    }))
    if (byTopic.size > 0)
      throw new Error(
        `compare: rows in no group: ${[...byTopic.keys()].join(", ")}`
      )
    return grouped
  })()
