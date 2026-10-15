/**
 * /compare: Kirana next to four kinds of styling tool, on plain questions in five groups. The
 * table is a grid of rows whose header stays in view while the rows scroll. A help is an ink tick, a
 * cost is a muted cross and a design choice is plain words, so colour is never the only signal.
 * Kirana's column sits on a quiet band. On a narrow screen the table compares Kirana with one tool
 * at a time, picked above it. Every cell's full statement and its source are under the table.
 */
import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  Cancel01Icon,
  LinkSquare02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Icon } from "@workspace/ui/primitives/icon"
import { VisuallyHidden } from "@workspace/ui/primitives/visually-hidden"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { GROUPED, ROWS, TOOLS } from "@/data/compare"
import type { Cell, Row, Tool } from "@/data/compare"
import { SVGL } from "@/generated/svgl-icons.gen"

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  head: () => ({
    meta: [
      { title: "Compare · Kirana" },
      {
        name: "description",
        content:
          "Kirana next to runtime CSS-in-JS, StyleX, Panda CSS and Tailwind, on plain questions, every cell taken from the tool's own documentation.",
      },
    ],
  }),
})

/** The table's width: the question, then a column per tool on a wide screen. */
const COLUMNS = {
  base: "minmax(7.5rem, 1.1fr) repeat(2, minmax(0, 1fr))",
  [breakpoint.lg]: "minmax(12rem, 1.3fr) repeat(5, minmax(0, 1fr))",
}

const styles = {
  picker: css({
    display: { base: "flex", [breakpoint.lg]: "none" },
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing[3],
    fontSize: fontSize.sm,
    color: theme.mutedForeground,
  }),
  table: css({ display: "grid" }),
  row: css({
    display: "grid",
    gridTemplateColumns: COLUMNS,
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  // The tools' names stay in view under the site header while the rows scroll.
  head: css({
    position: "sticky",
    insetBlockStart: "4rem",
    zIndex: 2,
    alignItems: "end",
    backgroundColor: theme.background,
    borderBlockEndColor: theme.foreground,
  }),
  headCell: css({
    display: "grid",
    gap: spacing[2],
    paddingInline: { base: spacing[2], [breakpoint.md]: spacing[4] },
    paddingBlock: spacing[4],
  }),
  questionHead: css({
    alignSelf: "end",
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  logo: css({
    display: "grid",
    placeItems: "center",
    width: "2rem",
    height: "2rem",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    fontWeight: fontWeight.semibold,
    color: theme.mutedForeground,
  }),
  mark: css({ height: "1.125rem" }),
  toolName: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  toolNote: css({
    display: { base: "none", [breakpoint.md]: "block" },
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  // A group of questions: its name across the table, with room above it.
  group: css({
    gridColumn: "1 / -1",
    paddingBlockStart: spacing[10],
    paddingBlockEnd: spacing[3],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    fontFamily: fontFamily.heading,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    letterSpacing: "-0.01em",
    color: theme.foreground,
  }),
  question: css({
    display: "grid",
    gap: spacing[1],
    alignContent: "start",
    paddingInlineEnd: spacing[3],
    paddingBlock: spacing[4],
  }),
  questionName: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  questionHelp: css({
    display: { base: "none", [breakpoint.md]: "block" },
    fontSize: fontSize.xs,
    lineHeight: "1.5",
    color: theme.mutedForeground,
  }),
  cell: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    minWidth: 0,
    // A one-word answer (`firstThatWorks`) still fits a phone's narrow column.
    overflowWrap: "anywhere",
    paddingInline: { base: spacing[2], [breakpoint.md]: spacing[4] },
    paddingBlock: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: "1.5",
  }),
  // Kirana's column: a quiet band down the table.
  ours: css({ backgroundColor: alpha.muted50 }),
  // A column the narrow table leaves out; every column shows from `lg` up.
  wideOnly: css({ display: { base: "none", [breakpoint.lg]: "grid" } }),
  verdict: css({
    display: "flex",
    alignItems: "flex-start",
    gap: spacing["1.5"],
  }),
  good: css({ color: theme.foreground, fontWeight: fontWeight.medium }),
  bad: css({ color: theme.mutedForeground }),
  neutral: css({ color: theme.foreground }),
  none: css({ color: theme.mutedForeground, fontStyle: "italic" }),
  glyph: css({ flexShrink: 0, marginBlockStart: "0.2em" }),
  brands: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing["1.5"],
  }),

  // Under the table: every cell's full statement and its source.
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
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.foreground,
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
  unsourced: css({ color: theme.mutedForeground, fontStyle: "italic" }),
  source: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.xs,
    color: theme.mutedForeground,
    textDecorationLine: { base: "none", ":hover": "underline" },
  }),
  legend: css({
    display: "grid",
    gap: spacing[2],
    maxWidth: "48rem",
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
}

/** A tool's logo: Kirana's mark, its brand logo, or a monogram. */
function ToolLogo({ tool }: { tool: (typeof TOOLS)[number] }) {
  return (
    <span sx={styles.logo} aria-hidden="true">
      {tool.id === "kirana" ? (
        <KiranaMark title={null} sx={styles.mark} />
      ) : tool.logo ? (
        <BrandIcon icon={SVGL[tool.logo]} size="1.25rem" />
      ) : (
        tool.mark
      )}
    </span>
  )
}

/** The verdict in words, with a tick for a help and a cross for a cost; the full statement is below. */
function CellView({ cell }: { cell: Cell }) {
  return (
    <>
      <span sx={[styles.verdict, styles[cell.tone]]} title={cell.text}>
        {cell.tone === "good" ? (
          <>
            <Icon icon={Tick02Icon} size="0.875rem" sx={styles.glyph} />
            <VisuallyHidden>Helps you: </VisuallyHidden>
          </>
        ) : cell.tone === "bad" ? (
          <>
            <Icon icon={Cancel01Icon} size="0.875rem" sx={styles.glyph} />
            <VisuallyHidden>Costs you: </VisuallyHidden>
          </>
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
  // On a narrow screen: Kirana, and the one tool picked here.
  const [other, setOther] = useState<Tool>("stylex")
  const shown = (tool: Tool) =>
    tool === "kirana" || tool === other ? null : styles.wideOnly
  const others = TOOLS.filter((tool) => tool.id !== "kirana")

  return (
    <Page scene="still-water">
      <PageHero
        label="Compare"
        title={
          <>
            Next to the tools <Accent>you know.</Accent>
          </>
        }
        lede={`Runtime CSS-in-JS, StyleX, Panda CSS and Tailwind, on ${ROWS.length} plain questions in ${GROUPED.length} groups. A tick helps you, a cross costs you, plain words are a design choice. Every cell's exact wording and source are under the table.`}
      />

      <PageSection
        number="01"
        label="The table"
        title="Five tools, the same questions"
        lede="Checked against each tool's own documentation. These are design choices, not scores."
      >
        <div sx={styles.picker}>
          <span>Kirana next to</span>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[other]}
            onValueChange={(value) => {
              const next = value[0] as Tool | undefined
              if (next) setOther(next)
            }}
            aria-label="The tool to compare with"
          >
            {others.map((tool) => (
              <ToggleGroupItem key={tool.id} value={tool.id}>
                {tool.name.replace(" CSS", "")}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div
          sx={styles.table}
          role="table"
          aria-label="Kirana compared with four styling tools"
        >
          <div sx={[styles.row, styles.head]} role="row">
            <span
              sx={[styles.headCell, styles.questionHead]}
              role="columnheader"
            >
              Question
            </span>
            {TOOLS.map((tool) => (
              <span
                key={tool.id}
                sx={[
                  styles.headCell,
                  tool.id === "kirana" ? styles.ours : null,
                  shown(tool.id),
                ]}
                role="columnheader"
              >
                <ToolLogo tool={tool} />
                <span sx={styles.toolName}>{tool.name}</span>
                <span sx={styles.toolNote}>{tool.note}</span>
              </span>
            ))}
          </div>
          {GROUPED.map((group) => (
            <div key={group.title} sx={styles.table} role="rowgroup">
              <div sx={styles.row} role="row">
                <span sx={styles.group} role="rowheader">
                  {group.title}
                </span>
              </div>
              {group.rows.map((row) => (
                <div key={row.topic} sx={styles.row} role="row">
                  <span sx={styles.question} role="rowheader">
                    <span sx={styles.questionName}>{row.topic}</span>
                    <span sx={styles.questionHelp}>{row.help}</span>
                  </span>
                  {TOOLS.map((tool) => (
                    <span
                      key={tool.id}
                      sx={[
                        styles.cell,
                        tool.id === "kirana" ? styles.ours : null,
                        shown(tool.id),
                      ]}
                      role="cell"
                    >
                      <CellView cell={row.cells[tool.id]} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="Sources"
        title="Every answer, in full"
        lede="The exact statement behind each cell, with the page it comes from."
      >
        <div sx={styles.detailsGrid}>
          <span sx={styles.detailsLabel}>By question</span>
          <Accordion>
            {GROUPED.flatMap((group) => group.rows).map((row) => (
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
            Checked against each tool's documentation; the dates are in the data
            file beside each group of rows. Tools change: if a cell is out of
            date, its source is the place to check, and a correction is welcome.
          </p>
          <p>
            On the shadcn/ui port's applications Tailwind builds within 3 % of
            Kirana and faster on two of the three, and StyleX's raw CSS is
            smaller. The measured numbers, with their method, are on the
            compiler page.
          </p>
          <DocsLink href="/compiler#measured">
            <More>The measured numbers</More>
          </DocsLink>
        </div>
      </PageSection>
    </Page>
  )
}
