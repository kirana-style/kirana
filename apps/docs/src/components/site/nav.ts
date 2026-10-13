/**
 * What the site header and footer link to. One list, so the mega-menu, the
 * mobile menu and the footer never disagree about where a page lives.
 */
import {
  Alert02Icon,
  ArrowDataTransferHorizontalIcon,
  BookOpen01Icon,
  Clock01Icon,
  CommandLineIcon,
  FavouriteIcon,
  Flag01Icon,
  GitBranchIcon,
  GitCompareIcon,
  Idea01Icon,
  Image01Icon,
  JusticeScale01Icon,
  Layers01Icon,
  Link01Icon,
  News01Icon,
  PackageIcon,
  PaintBoardIcon,
  PlayIcon,
  RoboticIcon,
  Rocket01Icon,
  Route01Icon,
  SourceCodeIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import type { AccentName } from "@workspace/docs-ui/accent.ts"

type IconData = typeof SourceCodeIcon

export type NavLinkItem = {
  title: string
  description: string
  href: string
  icon: IconData
}

export type Featured = NavLinkItem & {
  accent: AccentName
  /** Which small illustration the card shows (`menu-art.tsx`). */
  art: "compile" | "migrate" | "start" | "why"
}

export type Menu = {
  title: string
  featured: readonly Featured[]
  columns: readonly { title?: string; links: readonly NavLinkItem[] }[]
}

export const MENUS: readonly Menu[] = [
  {
    title: "Product",
    featured: [
      {
        title: "The compiler",
        description:
          "Typed styles in, atomic CSS out. Nothing styles your page at runtime.",
        href: "/compiler",
        icon: SourceCodeIcon,
        accent: "blue",
        art: "compile",
      },
      {
        title: "Migrate",
        description:
          "Move from Tailwind or StyleX with a codemod that reports what it will not guess.",
        href: "/migrate",
        icon: ArrowDataTransferHorizontalIcon,
        accent: "orange",
        art: "migrate",
      },
    ],
    columns: [
      {
        links: [
          {
            title: "Utilities",
            description: "Tailwind's names, compiled",
            href: "/docs/styling/utilities",
            icon: CommandLineIcon,
          },
          {
            title: "Relations",
            description: "group-* and peer-*, checked",
            href: "/docs/styling/relations",
            icon: Link01Icon,
          },
          {
            title: "Recipes",
            description: "Variants with slots",
            href: "/docs/styling/recipes",
            icon: Layers01Icon,
          },
        ],
      },
      {
        links: [
          {
            title: "Tokens and themes",
            description: "light-dark() pairs, modes",
            href: "/docs/tokens/overview",
            icon: PaintBoardIcon,
          },
          {
            title: "Diagnostics",
            description: "Every silent mistake, named",
            href: "/docs/tooling/diagnostics",
            icon: Alert02Icon,
          },
          {
            title: "Playground",
            description: "See a component compile",
            href: "/play",
            icon: PlayIcon,
          },
        ],
      },
    ],
  },
  {
    title: "Docs",
    featured: [
      {
        title: "Quick start",
        description: "Install, configure and style a first component.",
        href: "/docs/start/quick-start",
        icon: Rocket01Icon,
        accent: "emerald",
        art: "start",
      },
      {
        title: "Why Kirana",
        description:
          "What a compiler changes about CSS-in-JS, and what it costs.",
        href: "/docs/start/why-kirana",
        icon: Idea01Icon,
        accent: "violet",
        art: "why",
      },
    ],
    columns: [
      {
        title: "Guides",
        links: [
          {
            title: "Frameworks",
            description: "React, Vue, Svelte, Astro and more",
            href: "/docs/frameworks/overview",
            icon: Layers01Icon,
          },
          {
            title: "Mental model",
            description: "Four ideas behind every rule",
            href: "/docs/start/mental-model",
            icon: Route01Icon,
          },
          {
            title: "API reference",
            description: "Every export of @kirana-style/core",
            href: "/docs/reference/api",
            icon: BookOpen01Icon,
          },
        ],
      },
    ],
  },
  {
    title: "Resources",
    featured: [],
    columns: [
      {
        title: "Learn",
        links: [
          {
            title: "Blog",
            description: "Notes from building Kirana",
            href: "/blog",
            icon: News01Icon,
          },
          {
            title: "Showcase",
            description: "What is built with it",
            href: "/showcase",
            icon: SparklesIcon,
          },
          {
            title: "Compare",
            description: "Next to StyleX, Panda, Tailwind",
            href: "/compare",
            icon: GitCompareIcon,
          },
          {
            title: "For LLMs",
            description: "llms.txt and markdown pages",
            href: "/docs/project/llms",
            icon: RoboticIcon,
          },
          {
            title: "Agent skills",
            description: "npx skills add, for coding agents",
            href: "/docs/project/agent-skills",
            icon: RoboticIcon,
          },
        ],
      },
      {
        title: "Project",
        links: [
          {
            title: "What works today",
            description: "Built, partial and planned",
            href: "/docs/project/status",
            icon: Flag01Icon,
          },
          {
            title: "Roadmap",
            description: "The milestones",
            href: "/docs/project/roadmap",
            icon: Route01Icon,
          },
          {
            title: "Changelog",
            description: "What changed, and when",
            href: "/changelog",
            icon: Clock01Icon,
          },
          {
            title: "Ecosystem",
            description: "Packages, bundlers, status",
            href: "/ecosystem",
            icon: PackageIcon,
          },
          {
            title: "Brand",
            description: "Logo, colour and type",
            href: "/brand",
            icon: Image01Icon,
          },
        ],
      },
    ],
  },
  {
    title: "Community",
    featured: [],
    columns: [
      {
        links: [
          {
            title: "Contributing",
            description: "Report, document, write code",
            href: "/docs/project/contributing",
            icon: GitBranchIcon,
          },
          {
            title: "Sponsor",
            description: "Keep Kirana independent",
            href: "/sponsors",
            icon: FavouriteIcon,
          },
          {
            title: "Why Kirana",
            description: "The case, in brief",
            href: "/why",
            icon: UserGroupIcon,
          },
          {
            title: "Open source",
            description: "Why it is free, and stays so",
            href: "/open-source",
            icon: GitBranchIcon,
          },
          {
            title: "License",
            description: "MIT, and what it builds on",
            href: "/license",
            icon: JusticeScale01Icon,
          },
        ],
      },
    ],
  },
]

/** The footer's columns: everything the old footer linked, grouped the same way. */
export const FOOTER: readonly {
  title: string
  links: readonly { label: string; href: string }[]
}[] = [
  {
    title: "Learn",
    links: [
      { label: "Introduction", href: "/docs" },
      { label: "Why Kirana", href: "/docs/start/why-kirana" },
      { label: "Installation", href: "/docs/start/installation" },
      { label: "Supported frameworks", href: "/docs/frameworks/overview" },
      { label: "Quick start", href: "/docs/start/quick-start" },
      { label: "Mental model", href: "/docs/start/mental-model" },
      { label: "How it works", href: "/docs/start/how-it-works" },
      { label: "Habits for a new project", href: "/docs/start/tips" },
    ],
  },
  {
    title: "Reference",
    links: [
      { label: "API", href: "/docs/reference/api" },
      { label: "Configuration", href: "/docs/config/reference" },
      { label: "Diagnostics", href: "/docs/tooling/diagnostics" },
      { label: "CLI", href: "/docs/tooling/cli" },
      { label: "Lint", href: "/docs/tooling/lint" },
      { label: "Playground", href: "/play" },
      { label: "The compiler", href: "/compiler" },
      { label: "Compare", href: "/compare" },
      { label: "Ecosystem", href: "/ecosystem" },
    ],
  },
  {
    title: "Migrate",
    links: [
      { label: "Overview", href: "/migrate" },
      { label: "From Tailwind", href: "/docs/migration/from-tailwind" },
      { label: "From StyleX", href: "/docs/migration/from-stylex" },
      { label: "Verifying a migration", href: "/docs/advanced/conformance" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Showcase", href: "/showcase" },
      { label: "What works today", href: "/docs/project/status" },
      { label: "Roadmap", href: "/docs/project/roadmap" },
      { label: "Contributing", href: "/docs/project/contributing" },
      { label: "Sponsor", href: "/sponsors" },
      { label: "Open source", href: "/open-source" },
      { label: "License", href: "/license" },
      { label: "Brand", href: "/brand" },
      { label: "Releases", href: "/docs/project/releases" },
      { label: "Changelog", href: "/changelog" },
      { label: "For LLMs", href: "/docs/project/llms" },
      { label: "Agent skills", href: "/docs/project/agent-skills" },
    ],
  },
]
