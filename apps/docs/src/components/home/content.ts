import {
  Alert02Icon,
  Bug01Icon,
  CommandLineIcon,
  CpuIcon,
  DashboardSpeed01Icon,
  GitMergeIcon,
  Layers01Icon,
  Moon02Icon,
  PackageIcon,
  Route01Icon,
  SourceCodeIcon,
  Target02Icon,
  TextIcon,
} from "@hugeicons/core-free-icons"

import { FRAMEWORK_GUIDES } from "@/data/frameworks"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"

type IconData = typeof Target02Icon

export type Linked = { title: string; text: string; href: string }
export type WithIcon = Linked & { icon: IconData }

/** Runtime CSS-in-JS against Kirana, one row per complaint. `/docs/start/why-kirana` sources each. */
export const THEN_AND_NOW: { before: string; after: string }[] = [
  {
    before: "Styles serialised and injected while rendering",
    after: "Styles compiled to a stylesheet at build time",
  },
  {
    before: "A styling library shipped to every user",
    after: "Nothing for static styles; under 1 kB for runtime values",
  },
  {
    before: "Server rendering collects styles into the HTML",
    after: "A CSS file, linked like any other",
  },
  {
    before: "Insertion order decides which rule wins",
    after: "One stated precedence ladder, and a tool that explains it",
  },
]

export const PILLARS: WithIcon[] = [
  {
    icon: Target02Icon,
    title: "Predictable",
    text: "You can tell which style wins, and the compiler tells you when you cannot.",
    href: "/docs/styling/precedence",
  },
  {
    icon: TextIcon,
    title: "Readable",
    text: "Properties and values, with conditions inside the value they change — not a class-name grammar.",
    href: "/docs/start/mental-model",
  },
  {
    icon: DashboardSpeed01Icon,
    title: "Proportional",
    text: "One class per declaration, shared across components. Work scales with your styles, not your dependency graph.",
    href: "/docs/advanced/output",
  },
]

export const FEATURES: WithIcon[] = [
  {
    icon: CpuIcon,
    title: "No runtime style engine",
    text: "A stylesheet and class names. The optional helper is under 1 kB.",
    href: "/docs/start/how-it-works",
  },
  {
    icon: SourceCodeIcon,
    title: "Typed styles",
    text: "Real CSS properties and values, checked by TypeScript.",
    href: "/docs/styling/styles",
  },
  {
    icon: Route01Icon,
    title: "Conditions in the value",
    text: "Hover, attributes, breakpoints and container queries, written where they apply.",
    href: "/docs/styling/conditions",
  },
  {
    icon: GitMergeIcon,
    title: "Per-entry merging",
    text: "A later style replaces the entries it names, and keeps the rest.",
    href: "/docs/styling/merging",
  },
  {
    icon: Moon02Icon,
    title: "light-dark() themes",
    text: "One pair per colour. No dark variant, no second stylesheet.",
    href: "/docs/tokens/themes-and-modes",
  },
  {
    icon: Alert02Icon,
    title: `${DIAGNOSTICS.length} diagnostics`,
    text: "Stable codes and help text for the mistakes that used to be silent.",
    href: "/docs/tooling/diagnostics",
  },
  {
    icon: Bug01Icon,
    title: "kirana trace",
    text: "Ask which declaration wins for a property, and which rule decided it.",
    href: "/docs/tooling/debugging",
  },
  {
    icon: Layers01Icon,
    title: "Layers you control",
    text: "Your reset stays below every Kirana rule. Nothing is emitted unlayered.",
    href: "/docs/config/layers",
  },
]

/** The frameworks with an install guide, each built and checked on every change. */
export const FRAMEWORKS: Linked[] = FRAMEWORK_GUIDES.filter(
  (guide) => guide.group !== "bundlers"
).map((guide) => ({
  title: guide.title,
  text: guide.runsOn,
  href: guide.href,
}))

export const MIGRATIONS: (WithIcon & { figure: string })[] = [
  {
    icon: CommandLineIcon,
    title: "From Tailwind",
    figure: "0 differences on 189 routes",
    text: "kirana migrate tailwind rewrites class strings, cn and cva. On shadcn/ui's three apps it matched the original in every computed style, at rest and with menus open.",
    href: "/docs/migration/from-tailwind",
  },
  {
    icon: PackageIcon,
    title: "From StyleX",
    figure: "Close to one-to-one",
    text: "kirana migrate stylex maps create, defineVars and markers across, then the compiler finds the relations without anchors and the components that drop sx.",
    href: "/docs/migration/from-stylex",
  },
]

/** Figures shown under the hero; each is measured and stated on the linked page. */
export const STATS: Linked[] = [
  {
    title: "0",
    text: "computed-style differences after migrating shadcn/ui from Tailwind",
    href: "/docs/migration/from-tailwind",
  },
  {
    title: "< 1 kB",
    text: "runtime, and only in modules with runtime values",
    href: "/docs/styling/dynamic",
  },
  {
    title: String(DIAGNOSTICS.length),
    text: "diagnostics for mistakes that used to be silent",
    href: "/docs/tooling/diagnostics",
  },
  {
    title: String(FRAMEWORKS.length),
    text: "framework guides, from React to Rails, each checked on every change",
    href: "/docs/frameworks/overview",
  },
]
