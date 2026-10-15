/**
 * The changelog, until there are releases. Nothing is published yet
 * (`/docs/project/releases`), so each entry is a milestone or sprint from
 * the implementation tracker, dated by the commit that landed it. Newest first.
 */
export type Tag = "compiler" | "migrate" | "ecosystem" | "docs" | "milestone"

export type Entry = {
  date: string
  title: string
  tags: readonly Tag[]
  summary: string
  items: readonly string[]
  href?: string
}

/** Each tag in the hue of the place its subject lives on the site (`src/brand/scenes.ts`). */
export const TAG_ACCENTS = {
  compiler: "crater",
  migrate: "terracotta",
  ecosystem: "tea",
  docs: "forest",
  milestone: "ochre",
} as const

export const CHANGELOG: readonly Entry[] = [
  {
    date: "2026-10-12",
    title: "Agent skills, Biome and kirana export",
    tags: ["compiler", "ecosystem", "docs"],
    summary:
      "Coding agents get installable skills, Biome gets Kirana's syntactic lint rules, and the design system can be read as data.",
    items: [
      "Two agent skills, kirana and kirana-migrate, installed with npx skills add; their diagnostics and lint references are generated from the compiler",
      "@kirana-style/biome-plugin: sx-last, no-conflicting-props, no-dark-variant and no-class-helpers as GritQL plugins, held to the ESLint rules by a test",
      "Two new lint rules: no-dark-variant and no-class-helpers",
      "kirana export: tokens, themes, recipes, relations and named definitions as JSON, each with where it is declared",
      "kirana check --format github annotates pull requests, and --max-warnings fails on warnings",
    ],
    href: "/docs/project/agent-skills",
  },
  {
    date: "2026-10-12",
    title: "Fallbacks, anchor positioning, view transitions and bug reports",
    tags: ["compiler", "docs"],
    summary:
      "The three CSS helpers StyleX and Panda CSS 2 ship, each checked at build time, and a bug report that is safe to paste.",
    items: [
      "firstThatWorks(): a value and its fallbacks in one declaration run, the preferred last",
      "positionTry(): @position-try rules, with properties the block ignores reported",
      "viewTransition(): a style handle that is also the view-transition-class name",
      "kirana doctor --report: versions, checks, diagnostics by code and an optional trace, without source text or machine paths",
    ],
    href: "/docs/styling/fallbacks",
  },
  {
    date: "2026-10-06",
    title: "Every framework, server templates included",
    tags: ["compiler", "ecosystem", "docs"],
    summary:
      "A guide and a tested example for every framework Tailwind has a guide for, and server-rendered templates through a class map.",
    items: [
      "React Router, Gatsby, Ember, Meteor and Parcel, each with an example CI builds and checks in a browser and on its dev server",
      "Class maps: Laravel, Symfony, Rails, Phoenix and AdonisJS templates name styles from TypeScript modules, merged by helpers held to the runtime's 400 merge cases",
      "A Get started page with framework tiles, and a page for every bundler",
      "Hover, colours and unknown-name diagnostics in Blade, Twig, ERB, HEEx and Edge templates",
    ],
    href: "/docs/frameworks/overview",
  },
  {
    date: "2026-10-06",
    title: "Qwik and Angular",
    tags: ["compiler", "ecosystem"],
    summary:
      "The last two major frameworks without a guide, each with an example CI builds and checks in a browser.",
    items: [
      "Qwik 2 as a JSX mode: sx compiles to class, detected from jsxImportSource",
      "@kirana-style/angular: an [sx] directive for templates, Kirana's builders for the Angular CLI, and a Vite plugin for Analog",
      "Editor hints, hover cards and diagnostics in Angular templates, inline and in templateUrl files",
      "kirana init sets up Qwik, Analog and Angular CLI projects",
    ],
    href: "/docs/frameworks/overview",
  },
  {
    date: "2026-09-29",
    title: "A new documentation site",
    tags: ["docs"],
    summary:
      "The docs framework split into a content engine and a layout, and the site rebuilt on them.",
    items: [
      "docs-core (content, search, highlighting, llms.txt) and docs-ui (layout, sidebar, table of contents, copy page) as separate packages",
      "Section tabs with their own accents, install tabs per package manager, framework logos",
      "A homepage whose panels are the compiler's own output",
      "Compiler, migrate, compare, ecosystem, open-source and licence pages",
    ],
  },
  {
    date: "2026-09-28",
    title: "M5 passes: the migrated twin matches the Tailwind original",
    tags: ["milestone", "migrate"],
    summary:
      "kirana migrate tailwind over the Tailwind original of our shadcn/ui port, with 38 hand patches, renders with zero computed-style differences on 189 routes, at rest and with overlays open.",
    items: [
      "The codemod moves contextual rules onto data-slot targets, migrates in-data-[slot=x] as a relation, and reports dropped guards",
      "Dark values outrank the states they enclose",
      "A build checks relations only for the modules it compiled (D-062)",
    ],
    href: "/docs/migration/from-tailwind",
  },
  {
    date: "2026-09-23",
    title: "M4: every bundler and framework",
    tags: ["milestone", "ecosystem"],
    summary:
      "Kirana installable outside this repository, with installation tested in CI from packed tarballs.",
    items: [
      "Adapters for Rolldown, webpack, Rspack, Bun, esbuild and Jest beside Vite",
      "Preact, Solid, Vue, Nuxt, Svelte, SvelteKit and Astro, each with a tested example",
      "The utility surface: string sx and @kirana-style/preset-scales (M5 begins)",
    ],
    href: "/docs/integrations/ecosystem",
  },
  {
    date: "2026-09-22",
    title: "M2 complete",
    tags: ["milestone", "compiler"],
    summary:
      "The milestone's validation results recorded, and the roadmap updated.",
    items: [],
    href: "/docs/project/roadmap",
  },
  {
    date: "2026-09-21",
    title: "Sprint 3: the documentation site",
    tags: ["docs", "migrate"],
    summary:
      "The site you are reading, on the repository's own stack, plus the first codemod crate.",
    items: [
      "Markdown content, build-time highlighting, search, llms.txt and a markdown twin per page",
      "kirana_migrate, the codemod crate",
      "Class names take a four-character value hash, to keep hash collisions rare",
    ],
  },
  {
    date: "2026-09-16",
    title: "Sprint 2: the full three-way corpus",
    tags: ["compiler"],
    summary:
      "The blocks and examples apps return, ported to Kirana, so benchmarks and conformance compare the same three apps in all three implementations.",
    items: [
      "Every Kirana package at 100 % coverage, Rust and TypeScript",
      "Evaluator functions",
    ],
  },
  {
    date: "2026-09-15",
    title: "Sprint 1: the engine",
    tags: ["compiler"],
    summary:
      "A working compiler integrated with Vite, compiling the demo page with computed-style parity against the StyleX port.",
    items: [
      "Rust crates for parsing, evaluation, atoms and emission",
      "tsconfig paths in the resolver; unresolved-import warnings",
      "Shorthand atoms and CSS minification",
    ],
    href: "/docs/start/how-it-works",
  },
]
