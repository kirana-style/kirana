/**
 * "The system": four parts of Kirana, one panel each, with a sticky tree beside
 * them on wide screens. The tree follows the panel being read, and the whole
 * section takes that panel's accent.
 */
import { useEffect, useRef, useState } from "react"
import { css, props as styleProps } from "@kirana-style/core"
import {
  Alert02Icon,
  ArrowRight01Icon,
  CommandLineIcon,
  CpuIcon,
  DashboardSpeed01Icon,
} from "@hugeicons/core-free-icons"
import { motion, useReducedMotion } from "motion/react"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
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
import { More } from "@/components/page-section"
import { Eyebrow, Keycap } from "@/components/site/accents"
import { Rail } from "@/components/site/patterns"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"

import { BenchChart } from "./bench-chart"
import { MIGRATIONS, THEN_AND_NOW } from "./content"
import { frame } from "./frame"
import { LIFT, REST } from "@/components/site/lift"

type Part = {
  id: string
  label: string
  icon: IconProps["icon"]
  accent: AccentName
  title: string
  text: string
}

const PARTS: readonly Part[] = [
  {
    id: "compile",
    label: "Compile",
    icon: CpuIcon,
    accent: "crater",
    title: "Not the CSS-in-JS you left",
    text: "The dislike is earned — by libraries that built CSS in the browser while rendering. Kirana keeps what people liked, styles as typed values next to the component, and moves all the work to the build.",
  },
  {
    id: "benchmarks",
    label: "Benchmarks",
    icon: DashboardSpeed01Icon,
    accent: "crater",
    title: "Measured against the same apps",
    text: "The three demo applications, built from three branches: Kirana, the StyleX port, and the Tailwind original. Every one of them passes the same conformance checks.",
  },
  {
    id: "migrate",
    label: "Migrate",
    icon: CommandLineIcon,
    accent: "terracotta",
    title: "Bring what you have",
    text: "Both codemods print a diff and a report of what they would not decide, and write nothing until you say so.",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: Alert02Icon,
    accent: "crater",
    title: "Mistakes that used to be silent",
    text: `${DIAGNOSTICS.length} diagnostics with stable codes and help text, and kirana trace to ask which declaration wins a property and which rule decided it.`,
  },
]

/** The diagnostics, counted by family, in the order the compiler lists them. */
const FAMILIES = DIAGNOSTICS.reduce<[string, number][]>((all, entry) => {
  const found = all.find(([family]) => family === entry.family)
  if (found) found[1] += 1
  else all.push([entry.family, 1])
  return all
}, [])

const styles = {
  section: css({
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  layout: css({
    display: "grid",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "16rem minmax(0, 1fr)",
    },
  }),
  aside: css({
    display: { base: "none", [breakpoint.lg]: "block" },
    borderInlineEndWidth: "1px",
    borderInlineEndStyle: "solid",
    borderInlineEndColor: theme.border,
  }),
  tree: css({
    position: "sticky",
    insetBlockStart: spacing[24],
    display: "grid",
    gap: spacing[1],
    paddingInline: spacing[6],
    paddingBlock: spacing[20],
  }),
  treeTitle: css({
    marginBlockEnd: spacing[4],
    fontSize: "0.625rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  node: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    paddingBlock: spacing[2],
    paddingInlineStart: spacing[6],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    textDecorationLine: "none",
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      "[data-active]": theme.foreground,
    },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  // The trunk and each node's branch, drawn as borders.
  branch: css({
    position: "absolute",
    insetInlineStart: 0,
    insetBlock: 0,
    width: spacing[4],
    borderInlineStartWidth: "1px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: theme.border,
  }),
  twig: css({
    position: "absolute",
    insetInlineStart: 0,
    insetBlockStart: "50%",
    width: spacing[4],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  marker: css({
    position: "absolute",
    insetInlineStart: "-1px",
    insetBlock: spacing[1],
    width: "2px",
    borderRadius: "2px",
    backgroundColor: accent.base,
  }),
  dim: css({ opacity: { base: 0.45, ":is([data-active] *)": 1 } }),
  panels: css({ display: "grid", minWidth: 0 }),
  panel: css({
    display: "grid",
    gap: spacing[6],
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[14], [breakpoint.md]: spacing[20] },
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    scrollMarginBlockStart: spacing[16],
  }),

  // Compile: then and now, as rows read left to right — the old way, muted,
  // then what Kirana does instead. No ticks and crosses: the arrow says it.
  compare: css({
    display: "grid",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
  }),
  compareRow: css({
    display: "grid",
    alignItems: "center",
    gap: { base: spacing[2], [breakpoint.md]: spacing[4] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) 1.5rem minmax(0, 1fr)",
    },
    paddingInline: spacing[5],
    paddingBlock: spacing[4],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
  compareHead: css({
    display: { base: "none", [breakpoint.md]: "grid" },
    paddingBlock: spacing[3],
    fontSize: "0.6875rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
    backgroundColor: theme.background,
  }),
  before: css({ color: theme.mutedForeground }),
  arrow: css({
    display: { base: "none", [breakpoint.md]: "block" },
    justifySelf: "center",
    color: theme.mutedForeground,
  }),
  after: css({ fontWeight: fontWeight.medium, color: theme.foreground }),
  afterLabel: css({
    display: { base: "inline", [breakpoint.md]: "none" },
    marginInlineEnd: spacing["1.5"],
    color: accent.base,
  }),

  // Migrate
  grid2: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    padding: spacing[6],
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  figure: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    fontWeight: fontWeight.semibold,
    color: accent.base,
  }),

  // Diagnostics
  families: css({
    display: "grid",
    gap: "1px",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(5, minmax(0, 1fr))",
    },
  }),
  family: css({
    display: "grid",
    gap: spacing[1],
    padding: spacing[4],
    backgroundColor: theme.card,
  }),
  familyCount: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    fontWeight: fontWeight.semibold,
    color: accent.base,
  }),
  familyName: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  links: css({ display: "flex", flexWrap: "wrap", gap: spacing[5] }),
}

function Panel({ part, children }: { part: Part; children: React.ReactNode }) {
  return (
    <div id={`system-${part.id}`} sx={[accents[part.accent], styles.panel]}>
      <div sx={frame.head}>
        <Eyebrow>{part.label}</Eyebrow>
        <h3 sx={frame.title}>{part.title}</h3>
        <p sx={frame.lede}>{part.text}</p>
      </div>
      {children}
    </div>
  )
}

export function System() {
  const [active, setActive] = useState(PARTS[0]!.id)
  const panels = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const part = PARTS.find((item) => item.id === active)!

  // The active panel is the last one whose top has passed the middle of the viewport.
  useEffect(() => {
    const root = panels.current
    if (!root) return
    const update = () => {
      const middle = window.innerHeight / 2
      let current = PARTS[0]!.id
      for (const item of PARTS) {
        const element = root.querySelector(`#system-${item.id}`)
        if (element && element.getBoundingClientRect().top < middle)
          current = item.id
      }
      setActive(current)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <section sx={[styles.section, accents[part.accent]]}>
      <Rail sx={styles.layout}>
        <aside sx={styles.aside}>
          <nav sx={styles.tree} aria-label="The system">
            <span sx={styles.treeTitle}>The system</span>
            {PARTS.map((item) => (
              <a
                key={item.id}
                href={`#system-${item.id}`}
                data-active={item.id === active ? "" : undefined}
                sx={[accents[item.accent], styles.node]}
              >
                <span sx={styles.branch} aria-hidden="true" />
                <span sx={styles.twig} aria-hidden="true" />
                {item.id === active ? (
                  <motion.span
                    layoutId="home-system-marker"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 350, damping: 32 }
                    }
                    {...styleProps(styles.marker)}
                  />
                ) : null}
                <span sx={styles.dim}>
                  <Keycap icon={item.icon} />
                </span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <div ref={panels} sx={styles.panels}>
          <Panel part={PARTS[0]!}>
            <div sx={styles.compare} role="table">
              <div sx={[styles.compareRow, styles.compareHead]} role="row">
                <span role="columnheader">Runtime CSS-in-JS</span>
                <span />
                <span role="columnheader">Kirana</span>
              </div>
              {THEN_AND_NOW.map((row) => (
                <div key={row.before} sx={styles.compareRow} role="row">
                  <span sx={styles.before} role="cell">
                    {row.before}
                  </span>
                  <Icon icon={ArrowRight01Icon} size="1rem" sx={styles.arrow} />
                  <span sx={styles.after} role="cell">
                    <span sx={styles.afterLabel} aria-hidden="true">
                      →
                    </span>
                    {row.after}
                  </span>
                </div>
              ))}
            </div>
            <DocsLink href="/docs/start/why-kirana">
              <More>Why Kirana, with sources</More>
            </DocsLink>
          </Panel>

          <Panel part={PARTS[1]!}>
            <BenchChart />
            <DocsLink href="/docs/project/status">
              <More>What works today</More>
            </DocsLink>
          </Panel>

          <Panel part={PARTS[2]!}>
            <div sx={styles.grid2}>
              {MIGRATIONS.map((migration) => (
                <DocsLink
                  key={migration.title}
                  href={migration.href}
                  sx={styles.card}
                >
                  <Keycap icon={migration.icon} />
                  <span sx={frame.cardTitle}>{migration.title}</span>
                  <span sx={styles.figure}>{migration.figure}</span>
                  <span sx={frame.cardText}>{migration.text}</span>
                  <More>Read the guide</More>
                </DocsLink>
              ))}
            </div>
          </Panel>

          <Panel part={PARTS[3]!}>
            <div sx={styles.families}>
              {FAMILIES.map(([family, count]) => (
                <div key={family} sx={styles.family}>
                  <span sx={styles.familyCount}>{count}</span>
                  <span sx={styles.familyName}>{family}</span>
                </div>
              ))}
            </div>
            <div sx={styles.links}>
              <DocsLink href="/docs/tooling/diagnostics">
                <More>Every diagnostic</More>
              </DocsLink>
              <DocsLink href="/docs/tooling/debugging">
                <More>Debugging with kirana trace</More>
              </DocsLink>
            </div>
          </Panel>
        </div>
      </Rail>
    </section>
  )
}
