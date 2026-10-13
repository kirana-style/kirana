import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  DashboardSquare01Icon,
  GridViewIcon,
  Layers01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { GlowBand } from "@/components/site/accents"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { patterns } from "@/components/site/patterns"
import { LIFT, REST } from "@/components/site/lift"

export const Route = createFileRoute("/showcase")({
  component: Showcase,
  head: () => ({
    meta: [
      { title: "Showcase · Kirana" },
      {
        name: "description",
        content:
          "Applications built with Kirana, and what each of them put through the compiler.",
      },
    ],
  }),
})

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[5],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  // A placeholder until each entry has a screenshot: the entry's accent, a
  // pattern and its icon — tokens, not an image, so it themes with the page.
  thumbnail: css({
    position: "relative",
    display: "grid",
    placeItems: "center",
    aspectRatio: "16 / 7",
    overflow: "hidden",
    backgroundImage: `radial-gradient(80% 120% at 100% 0%, ${tint(22)}, transparent 65%), linear-gradient(${tint(6)}, ${tint(6)})`,
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  pattern: css({
    position: "absolute",
    inset: 0,
    color: tint(22),
    maskImage:
      "radial-gradient(70% 90% at 100% 0%, black 10%, transparent 75%)",
  }),
  mark: css({
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: spacing[16],
    height: spacing[16],
    borderRadius: radius.xl,
    backgroundColor: accent.base,
    color: accent.on,
    boxShadow: `0 10px 30px -10px ${tint(70)}`,
  }),
  body: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[3],
    padding: spacing[6],
  }),
  category: css({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: accent.base,
  }),
  name: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.bold,
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  facts: css({
    display: "grid",
    gap: spacing["1.5"],
    paddingInlineStart: spacing[5],
    listStyleType: "disc",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
  link: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    marginBlockStart: spacing[2],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: { base: theme.foreground, ":hover": accent.base },
    textDecorationLine: "none",
  }),
}

type Entry = {
  accent: AccentName
  icon: IconProps["icon"]
  pattern: "dots" | "petals" | "hatch"
  name: string
  category: string
  description: string
  facts: string[]
  href: string
  hrefLabel: string
}

/**
 * What is built on Kirana today.
 *
 * All four are in this repository, which is the point: every claim on this page
 * is something the conformance harness checks on every run.
 */
const ENTRIES: Entry[] = [
  {
    accent: "blue",
    icon: DashboardSquare01Icon,
    pattern: "dots",
    name: "The demo application",
    category: "Application",
    description:
      "A full page of composed UI — navigation, forms, tables, overlays and a three-way theme toggle — kept structurally identical to independent builds of the same markup.",
    facts: [
      "Every component in the design system, on one page",
      "Light, dark and system modes",
      "The reference for the conformance runs",
    ],
    href: "/docs/advanced/conformance",
    hrefLabel: "How it is verified",
  },
  {
    accent: "emerald",
    icon: GridViewIcon,
    pattern: "dots",
    name: "60+ shadcn blocks",
    category: "Blocks",
    description:
      "Dashboards, sidebars, login screens and previews: the largest single body of styles Kirana compiles, and the one that found most of the compiler's merge-order bugs.",
    facts: [
      "Sidebar, dashboard, authentication and preview blocks",
      "Deep component nesting and contextual styles",
      "Shares its shell with the examples app",
    ],
    href: "/docs/styling/merging",
    hrefLabel: "Merging and removal",
  },
  {
    accent: "violet",
    icon: Layers01Icon,
    pattern: "hatch",
    name: "Component examples",
    category: "Reference",
    description:
      "One page per component, each exercising its states — hover, focus, disabled, open, checked — because that is where precedence bugs live rather than in the default render.",
    facts: [
      "Every component, in every state it has",
      "Relations and contextual styles in anger",
      "Crawled in every state on each run",
    ],
    href: "/docs/styling/relations",
    hrefLabel: "Relations",
  },
  {
    accent: "amber",
    icon: BookOpen01Icon,
    pattern: "dots",
    name: "This documentation site",
    category: "Documentation",
    description:
      "TanStack Start, markdown compiled at build time, a search index, a playground and a syntax theme whose colours are Kirana tokens — styled entirely with the compiler it documents.",
    facts: [
      "Server-rendered, with styles in route files",
      "Syntax highlighting themed with light-dark() pairs",
      "Excluded from the benchmark corpus, on purpose",
    ],
    href: "/docs/frameworks/tanstack-start",
    hrefLabel: "React and TanStack Start",
  },
]

function Showcase() {
  return (
    <Page accent="violet">
      <PageHero
        icon={SparklesIcon}
        pattern="blocks"
        eyebrow="Showcase"
        title="Built with Kirana"
        lede="Kirana is pre-release, so this page is short and honest: these are the four applications built on it today, all of them in the repository, all of them verified against independent builds of the same markup."
      />
      <PageSection>
        <div sx={styles.grid}>
          {ENTRIES.map((entry) => (
            <article key={entry.name} sx={[accents[entry.accent], styles.card]}>
              <div sx={styles.thumbnail} aria-hidden="true">
                <span sx={[patterns[entry.pattern], styles.pattern]} />
                <span sx={styles.mark}>
                  <Icon icon={entry.icon} size="1.75rem" />
                </span>
              </div>
              <div sx={styles.body}>
                <span sx={styles.category}>{entry.category}</span>
                <h2 sx={styles.name}>{entry.name}</h2>
                <p sx={styles.description}>{entry.description}</p>
                <ul sx={styles.facts}>
                  {entry.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                <DocsLink href={entry.href} sx={styles.link}>
                  {entry.hrefLabel}
                  <Icon icon={ArrowRight01Icon} size="0.875rem" />
                </DocsLink>
              </div>
            </article>
          ))}
        </div>
      </PageSection>
      <PageSection flush>
        <GlowBand
          title="Built something with it?"
          actions={
            <Button
              size="lg"
              nativeButton={false}
              render={
                <DocsLink href="/docs/project/contributing">
                  How to get in touch
                </DocsLink>
              }
            />
          }
        >
          This page fills up once Kirana is published and people can install it.
          Until then, if you have built something on it, open an issue — an
          entry here needs a name, a link and one line about what it put through
          the compiler.
        </GlowBand>
      </PageSection>
    </Page>
  )
}
