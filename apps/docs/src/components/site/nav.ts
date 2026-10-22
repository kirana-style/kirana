/**
 * What the site header and footer link to. One list, so the mega-menu, the
 * mobile menu and the footer never disagree about where a page lives.
 */
import {
  ArrowDataTransferHorizontalIcon,
  BookOpen01Icon,
  Clock01Icon,
  CommandLineIcon,
  FavouriteIcon,
  GitBranchIcon,
  GitCompareIcon,
  HandshakeIcon,
  Idea01Icon,
  Image01Icon,
  JusticeScale01Icon,
  Layers01Icon,
  News01Icon,
  PackageIcon,
  PlayIcon,
  RoboticIcon,
  Rocket01Icon,
  Route01Icon,
  SourceCodeIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import type { SceneId } from "@/brand/scenes"

type IconData = typeof SourceCodeIcon

export type NavLinkItem = {
  title: string
  description: string
  href: string
  icon: IconData
  /** The scene the destination stands in: its glyph takes that scene's hue. */
  scene: SceneId
}

export type Featured = NavLinkItem & {
  /** Which small illustration floats on the scene (`menu-art.tsx`). */
  art: "compile" | "migrate" | "start" | "why"
}

export type Menu = {
  title: string
  featured: readonly Featured[]
  columns: readonly { title?: string; links: readonly NavLinkItem[] }[]
}

/** The sponsor link: the heart beside the menus, and a row in the mobile menu. */
export const SPONSOR: NavLinkItem = {
  title: "Sponsor",
  description: "Keep Kirana independent",
  href: "/sponsors",
  icon: FavouriteIcon,
  scene: "golden-fields",
}

/**
 * The header's three menus. Each page is in one place: the case for Kirana and the tools around
 * the compiler under Product, everything you read while building under Docs, and the project
 * itself under Community. Sponsoring is the heart button beside them, not a menu item.
 */
export const MENUS: readonly Menu[] = [
  {
    title: "Product",
    featured: [
      {
        title: "Why Kirana",
        description:
          "What a compiler changes about CSS-in-JS, and what it costs you.",
        href: "/why",
        icon: Idea01Icon,
        scene: "highlands",
        art: "why",
      },
      {
        title: "The compiler",
        description:
          "Typed styles in, one atomic stylesheet out. Nothing styles your page at runtime.",
        href: "/compiler",
        icon: SourceCodeIcon,
        scene: "crater-lake",
        art: "compile",
      },
    ],
    columns: [
      {
        links: [
          {
            title: "Migrate",
            description: "From Tailwind or StyleX, with a codemod",
            href: "/migrate",
            icon: ArrowDataTransferHorizontalIcon,
            scene: "heritage-street",
          },
          {
            title: "Compare",
            description: "Next to StyleX, Panda and Tailwind",
            href: "/compare",
            icon: GitCompareIcon,
            scene: "still-water",
          },
          {
            title: "In your editor",
            description: "Every element's CSS on its line",
            href: "/docs/tooling/editor",
            icon: CommandLineIcon,
            scene: "crater-lake",
          },
        ],
      },
      {
        links: [
          {
            title: "Playground",
            description: "See a component compile",
            href: "/play",
            icon: PlayIcon,
            scene: "turquoise-lake",
          },
          {
            title: "Ecosystem",
            description: "Packages, bundlers and their status",
            href: "/ecosystem",
            icon: PackageIcon,
            scene: "rock-garden",
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
        description:
          "Pick your framework: install, add the plugin, write a style.",
        href: "/docs/start/quick-start",
        icon: Rocket01Icon,
        scene: "highlands",
        art: "start",
      },
      {
        title: "Moving a project",
        description:
          "From Tailwind or StyleX, and how to check nothing changed.",
        href: "/docs/migration/from-tailwind",
        icon: ArrowDataTransferHorizontalIcon,
        scene: "heritage-street",
        art: "migrate",
      },
    ],
    columns: [
      {
        links: [
          {
            title: "Learn",
            description: "The model, styling, tokens",
            href: "/docs",
            icon: BookOpen01Icon,
            scene: "highlands",
          },
          {
            title: "Frameworks",
            description: "A guide for each framework and bundler",
            href: "/docs/frameworks/overview",
            icon: Layers01Icon,
            scene: "misty-hills",
          },
          {
            title: "Reference",
            description: "API, CLI and every diagnostic",
            href: "/docs/reference/api",
            icon: SourceCodeIcon,
            scene: "crater-lake",
          },
          {
            title: "For agents",
            description: "llms.txt and agent skills",
            href: "/docs/project/agent-skills",
            icon: RoboticIcon,
            scene: "old-hall",
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
        title: "Follow",
        links: [
          {
            title: "Blog",
            description: "Notes from building Kirana",
            href: "/blog",
            icon: News01Icon,
            scene: "lighthouse-coast",
          },
          {
            title: "Changelog",
            description: "What changed, and when",
            href: "/changelog",
            icon: Clock01Icon,
            scene: "forest-falls",
          },
          {
            title: "Roadmap",
            description: "What is built, and what comes next",
            href: "/docs/project/roadmap",
            icon: Route01Icon,
            scene: "old-hall",
          },
          {
            title: "Showcase",
            description: "What is built with it",
            href: "/showcase",
            icon: SparklesIcon,
            scene: "city-dusk",
          },
        ],
      },
      {
        title: "Take part",
        links: [
          {
            title: "Open source",
            description: "Why it is free, and stays so",
            href: "/open-source",
            icon: UserGroupIcon,
            scene: "old-hall",
          },
          {
            title: "Contributing",
            description: "Report, document, write code",
            href: "/docs/project/contributing",
            icon: GitBranchIcon,
            scene: "old-hall",
          },
          {
            title: "License",
            description: "MIT, and what it builds on",
            href: "/license",
            icon: JusticeScale01Icon,
            scene: "old-hall",
          },
          {
            title: "Brand",
            description: "The mark, colour, type and scenery",
            href: "/brand",
            icon: Image01Icon,
            scene: "highlands",
          },
        ],
      },
      {
        title: "Support",
        links: [
          SPONSOR,
          {
            title: "Partners",
            description: "The services Kirana runs on",
            href: "/partners",
            icon: HandshakeIcon,
            scene: "old-hall",
          },
        ],
      },
    ],
  },
]

/** The footer's link groups. */
export const FOOTER: readonly {
  title: string
  links: readonly { label: string; href: string }[]
}[] = [
  {
    title: "Learn",
    links: [
      { label: "Introduction", href: "/docs" },
      { label: "Why Kirana", href: "/why" },
      { label: "Quick start", href: "/docs/start/quick-start" },
      { label: "Installation", href: "/docs/start/installation" },
      { label: "Frameworks", href: "/docs/frameworks/overview" },
      { label: "Mental model", href: "/docs/start/mental-model" },
      { label: "How it works", href: "/docs/start/how-it-works" },
      { label: "From Tailwind", href: "/docs/migration/from-tailwind" },
      { label: "From StyleX", href: "/docs/migration/from-stylex" },
    ],
  },
  {
    title: "Reference",
    links: [
      { label: "API", href: "/docs/reference/api" },
      { label: "Configuration", href: "/docs/reference/config" },
      { label: "CLI", href: "/docs/tooling/cli" },
      { label: "Diagnostics", href: "/docs/tooling/diagnostics" },
      { label: "Lint", href: "/docs/tooling/lint" },
      { label: "Editor support", href: "/docs/tooling/editor" },
      { label: "The compiler", href: "/compiler" },
      { label: "Compare", href: "/compare" },
      { label: "Playground", href: "/play" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Changelog", href: "/changelog" },
      { label: "What works today", href: "/docs/project/status" },
      { label: "Roadmap", href: "/docs/project/roadmap" },
      { label: "Ecosystem", href: "/ecosystem" },
      { label: "Showcase", href: "/showcase" },
      { label: "Contributing", href: "/docs/project/contributing" },
      { label: "Sponsor", href: "/sponsors" },
      { label: "Partners", href: "/partners" },
      { label: "Open source", href: "/open-source" },
      { label: "License", href: "/license" },
      { label: "Brand", href: "/brand" },
      { label: "For LLMs", href: "/docs/project/llms" },
      { label: "Agent skills", href: "/docs/project/agent-skills" },
    ],
  },
]
