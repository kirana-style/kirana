/**
 * The docs home's shortcuts: one group per docs tab, with the pages most
 * people want first. The component draws them; `shortcutsMarkdown` is the
 * same list for the page's markdown twin.
 */
export type Shortcut = {
  /** A tab id from `TABS` in `docs-config.tsx`, which gives label, accent and icon. */
  tab: "docs" | "frameworks" | "guides" | "reference" | "project"
  text: string
  links: readonly { title: string; href: string }[]
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    tab: "docs",
    text: "The model, writing styles, tokens and configuration.",
    links: [
      { title: "Quick start", href: "/docs/start/quick-start" },
      { title: "How it works", href: "/docs/start/how-it-works" },
      { title: "Mental model", href: "/docs/start/mental-model" },
    ],
  },
  {
    tab: "frameworks",
    text: "An install guide for every framework and bundler, each built on every change.",
    links: [
      { title: "Vue", href: "/docs/frameworks/vue" },
      { title: "Next.js", href: "/docs/frameworks/nextjs" },
      { title: "TanStack Start", href: "/docs/frameworks/tanstack-start" },
    ],
  },
  {
    tab: "guides",
    text: "Moving from Tailwind or StyleX, and building larger systems.",
    links: [
      { title: "From Tailwind", href: "/docs/migration/from-tailwind" },
      { title: "From StyleX", href: "/docs/migration/from-stylex" },
      { title: "A design system", href: "/docs/advanced/design-system" },
    ],
  },
  {
    tab: "reference",
    text: "The API, the command line, and every diagnostic with its code.",
    links: [
      { title: "API", href: "/docs/reference/api" },
      { title: "CLI", href: "/docs/tooling/cli" },
      { title: "Diagnostics", href: "/docs/tooling/diagnostics" },
    ],
  },
  {
    tab: "project",
    text: "Where Kirana stands, what comes next, and how to help.",
    links: [
      { title: "Status", href: "/docs/project/status" },
      { title: "Roadmap", href: "/docs/project/roadmap" },
      { title: "Contributing", href: "/docs/project/contributing" },
    ],
  },
]

const LABELS: Record<Shortcut["tab"], string> = {
  docs: "Documentation",
  frameworks: "Frameworks",
  guides: "Guides",
  reference: "Reference",
  project: "Project",
}

export function shortcutsMarkdown() {
  return SHORTCUTS.map(
    (group) =>
      `- **${LABELS[group.tab]}**: ${group.text} ${group.links
        .map((link) => `[${link.title}](${link.href})`)
        .join(", ")}`
  ).join("\n")
}
