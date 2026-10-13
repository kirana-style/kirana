import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  Cancel01Icon,
  GitCompareIcon,
  LinkSquare02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { patterns } from "@/components/site/patterns"
import { DANGER, SUCCESS } from "@/components/site/visuals"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { KiranaMark } from "@/brand/kirana-mark-svg"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { SVGL } from "@/generated/svgl-icons.gen"
import { ROWS, TOOLS } from "@/data/compare"
import type { Cell, Row } from "@/data/compare"

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  head: () => ({
    meta: [
      { title: "Compare · Kirana" },
      {
        name: "description",
        content:
          "Kirana next to runtime CSS-in-JS, StyleX, Panda CSS and Tailwind — every cell taken from the tool's own documentation.",
      },
    ],
  }),
})

const styles = {
  scroller: css({
    overflowX: "auto",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    scrollbarWidth: "thin",
  }),
  table: css({
    width: "100%",
    minWidth: "54rem",
    borderCollapse: "collapse",
    fontSize: fontSize.sm,
    lineHeight: "1.55",
  }),
  th: css({
    paddingInline: spacing[4],
    paddingBlock: spacing[4],
    textAlign: "start",
    verticalAlign: "bottom",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    backgroundColor: theme.card,
  }),
  // A tool's logo, on a small tile like the figures' tiles.
  toolHead: css({ display: "flex", alignItems: "center", gap: spacing["2.5"] }),
  logo: css({
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "2rem",
    height: "2rem",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
    boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)",
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    fontWeight: fontWeight.semibold,
    color: theme.mutedForeground,
  }),
  mark: css({ height: "1.125rem" }),
  brands: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing["1.5"],
    marginBlockStart: spacing[2],
  }),
  toolName: css({
    display: "block",
    fontFamily: fontFamily.heading,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.bold,
  }),
  toolNote: css({
    display: "block",
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  // The topic column stays put while the table scrolls sideways.
  topic: css({
    position: "sticky",
    insetInlineStart: 0,
    zIndex: 1,
    width: "13rem",
    paddingInline: spacing[4],
    paddingBlock: spacing[4],
    textAlign: "start",
    verticalAlign: "top",
    fontWeight: fontWeight.semibold,
    backgroundColor: theme.card,
    borderInlineEndWidth: "1px",
    borderInlineEndStyle: "solid",
    borderInlineEndColor: theme.border,
  }),
  cornerHead: css({ zIndex: 2 }),
  td: css({
    paddingInline: spacing[4],
    paddingBlock: spacing[4],
    verticalAlign: "top",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  rowRule: css({
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  ours: css({ backgroundColor: tint(7) }),
  oursHead: css({ color: accent.base }),
  unsourced: css({ color: theme.mutedForeground, fontStyle: "italic" }),
  source: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.xs,
    color: theme.mutedForeground,
    textDecorationLine: { base: "none", ":hover": "underline" },
  }),
  chip: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    borderRadius: radius.full,
    paddingInline: spacing["2.5"],
    paddingBlock: "2px",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
  }),
  topicName: css({ display: "block" }),
  topicHelp: css({
    display: "block",
    marginBlockStart: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: "1.5",
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  // The homepage FAQ's layout: a label on the left, the accordion across the rest.
  detailsGrid: css({
    display: "grid",
    gap: { base: spacing[3], [breakpoint.lg]: spacing[10] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "14rem minmax(0, 1fr)",
    },
  }),
  detailsLabel: css({
    paddingBlockStart: spacing[3],
    fontSize: "0.6875rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: accent.base,
  }),
  detailList: css({
    display: "grid",
    gap: spacing[2],
    paddingBlock: spacing[1],
  }),
  detail: css({
    display: "grid",
    gap: { base: spacing["0.5"], [breakpoint.md]: spacing[4] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "10rem minmax(0, 1fr) auto",
    },
    alignItems: "baseline",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
  detailTool: css({ fontWeight: fontWeight.medium }),
  detailText: css({ color: theme.mutedForeground }),
  hatch: css({ height: spacing[6] }),
  legend: css({
    display: "grid",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
}

function Source({ href }: { href: string }) {
  const external = href.startsWith("http")
  const label = external ? new URL(href).hostname.replace(/^www\./, "") : "docs"
  return (
    <DocsLink href={href} sx={styles.source}>
      {label}
      {external ? <Icon icon={LinkSquare02Icon} size="0.6875rem" /> : null}
    </DocsLink>
  )
}

const CHIP = {
  good: css({
    color: SUCCESS,
    backgroundColor: `color-mix(in oklab, ${SUCCESS} 12%, transparent)`,
  }),
  bad: css({
    color: DANGER,
    backgroundColor: `color-mix(in oklab, ${DANGER} 12%, transparent)`,
  }),
  neutral: css({ color: theme.foreground, backgroundColor: theme.muted }),
  none: css({ color: theme.mutedForeground, backgroundColor: "transparent" }),
}

/** The verdict at a glance; the full statement and its source are below. */
function CellView({ cell }: { cell: Cell }) {
  return (
    <>
      <span sx={[styles.chip, CHIP[cell.tone]]} title={cell.text}>
        {cell.tone === "good" ? (
          <Icon icon={Tick02Icon} size="0.75rem" />
        ) : cell.tone === "bad" ? (
          <Icon icon={Cancel01Icon} size="0.75rem" />
        ) : null}
        {cell.short}
      </span>
      {cell.brands ? (
        <span sx={styles.brands}>
          {cell.brands.map((brand) => (
            <span key={brand} title={SVGL[brand].title}>
              <BrandIcon icon={SVGL[brand]} size="1rem" />
            </span>
          ))}
        </span>
      ) : null}
    </>
  )
}

/** A tool's logo: Kirana's mark, its brand logo, or a monogram. */
function ToolLogo({ tool }: { tool: (typeof TOOLS)[number] }) {
  const ours = tool.id === "kirana"
  return (
    <span sx={styles.logo} aria-hidden="true">
      {ours ? (
        <KiranaMark title={null} sx={styles.mark} />
      ) : tool.logo ? (
        <BrandIcon icon={SVGL[tool.logo]} size="1.25rem" />
      ) : (
        tool.mark
      )}
    </span>
  )
}

/** One question, every tool's full answer with the page it comes from. */
function Details({ row }: { row: Row }) {
  return (
    <ul sx={styles.detailList}>
      {TOOLS.map((tool) => {
        const cell = row.cells[tool.id]
        return (
          <li key={tool.id} sx={styles.detail}>
            <span sx={styles.detailTool}>{tool.name}</span>
            <span sx={styles.detailText}>
              {cell.source ? (
                cell.text
              ) : (
                <span sx={styles.unsourced}>{cell.text}</span>
              )}
            </span>
            {cell.source ? <Source href={cell.source} /> : <span />}
          </li>
        )
      })}
    </ul>
  )
}

function ComparePage() {
  return (
    <Page accent="sky">
      <PageHero
        icon={GitCompareIcon}
        pattern="waves"
        eyebrow="Compare"
        title={
          <>
            Next to the tools <Accent>you know.</Accent>
          </>
        }
        lede={`Runtime CSS-in-JS, StyleX, Panda CSS and Tailwind, on ${ROWS.length} plain questions. Green helps you, red costs you, grey is a design choice. The exact wording and its source for every cell are under the table.`}
      />

      <PageSection flush>
        <div sx={[patterns.hatch, styles.hatch]} aria-hidden="true" />
      </PageSection>
      <PageSection>
        <div sx={styles.scroller}>
          <table sx={styles.table}>
            <thead>
              <tr>
                <th sx={[styles.topic, styles.cornerHead]} scope="col">
                  <span sx={styles.toolNote}>Question</span>
                </th>
                {TOOLS.map((tool) => (
                  <th
                    key={tool.id}
                    scope="col"
                    sx={[
                      styles.th,
                      tool.id === "kirana" ? styles.oursHead : null,
                    ]}
                  >
                    <span sx={styles.toolHead}>
                      <ToolLogo tool={tool} />
                      <span>
                        <span sx={styles.toolName}>{tool.name}</span>
                        <span sx={styles.toolNote}>{tool.note}</span>
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.topic}>
                  <th scope="row" sx={[styles.topic, styles.rowRule]}>
                    <span sx={styles.topicName}>{row.topic}</span>
                    <span sx={styles.topicHelp}>{row.help}</span>
                  </th>
                  {TOOLS.map((tool) => (
                    <td
                      key={tool.id}
                      sx={[
                        styles.td,
                        tool.id === "kirana" ? styles.ours : null,
                      ]}
                    >
                      <CellView cell={row.cells[tool.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div sx={styles.detailsGrid}>
          <span sx={styles.detailsLabel}>Details and sources</span>
          <Accordion>
            {ROWS.map((row) => (
              <AccordionItem key={row.topic} value={row.topic}>
                <AccordionTrigger>{row.topic}</AccordionTrigger>
                <AccordionContent>
                  <Details row={row} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div sx={styles.legend}>
          <p>
            Checked against each tool's documentation on 29 September 2026.
            Tools change; if a cell is out of date, the source link is the place
            to check, and a correction is welcome.
          </p>
          <p>
            These are design choices, not scores. On the shadcn/ui port's apps
            Tailwind builds within 3 % of Kirana and faster on two of three, and
            StyleX's raw CSS is smaller — the measured numbers are on the
            homepage.
          </p>
          <DocsLink href="/docs/start/why-kirana">
            <More>Why Kirana, with sources</More>
          </DocsLink>
        </div>
      </PageSection>
    </Page>
  )
}
