/**
 * Evidence the product pages show in a chapter: runtime CSS-in-JS against Kirana, row by row
 * (`/why`), and the diagnostics counted by family (`/compiler`). Both read their data from the
 * sources the rest of the site reads, so a count is never typed twice.
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { accent } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
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

import { THEN_AND_NOW } from "@/data/claims"
import { familyIcon } from "@/data/diagnostic-families"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"

const styles = {
  // Then and now, read left to right: the old way, muted, then what Kirana does instead.
  compare: css({
    display: "grid",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
  }),
  row: css({
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
  head: css({
    display: { base: "none", [breakpoint.md]: "grid" },
    paddingBlock: spacing[3],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
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

  // The diagnostics, one cell per family, split by 1px gutters.
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
  // The family's icon and its name on the left; the count in the cell's top-right corner.
  family: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    columnGap: spacing[3],
    rowGap: spacing[1],
    padding: spacing[4],
    backgroundColor: theme.card,
  }),
  familyIcon: css({
    gridColumn: "1",
    gridRow: "1",
    justifySelf: "start",
    alignSelf: "center",
    // Lighter than the family's name, so the count stays the cell's one accent.
    color: theme.mutedForeground,
    opacity: 0.5,
  }),
  familyCount: css({
    gridColumn: "2",
    gridRow: "1",
    justifySelf: "end",
    fontFamily: fontFamily.numeric,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    fontWeight: fontWeight.semibold,
    color: accent.base,
  }),
  familyName: css({
    gridColumn: "1 / -1",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
}

/** Runtime CSS-in-JS against Kirana, one row per complaint. */
export function ThenAndNow() {
  return (
    <div
      sx={styles.compare}
      role="table"
      aria-label="Runtime CSS-in-JS against Kirana"
    >
      <div sx={[styles.row, styles.head]} role="row">
        <span role="columnheader">Runtime CSS-in-JS</span>
        <span />
        <span role="columnheader">Kirana</span>
      </div>
      {THEN_AND_NOW.map((row) => (
        <div key={row.before} sx={styles.row} role="row">
          <span sx={styles.before} role="cell">
            {row.before}
          </span>
          <Icon icon={ArrowRight01Icon} size="1rem" sx={styles.arrow} />
          <span sx={styles.after} role="cell">
            <span sx={styles.afterLabel} aria-hidden="true">
              Now:
            </span>
            {row.after}
          </span>
        </div>
      ))}
    </div>
  )
}

/** The diagnostics, counted by family, in the order the compiler lists them. */
const FAMILIES = DIAGNOSTICS.reduce<[string, number][]>((all, entry) => {
  const found = all.find(([family]) => family === entry.family)
  if (found) found[1] += 1
  else all.push([entry.family, 1])
  return all
}, [])

export function DiagnosticFamilies() {
  return (
    <div sx={styles.families}>
      {FAMILIES.map(([family, count]) => (
        <div key={family} sx={styles.family}>
          <span sx={styles.familyCount}>{count}</span>
          <Icon
            icon={familyIcon(family)}
            size="1.75rem"
            strokeWidth={1.5}
            sx={styles.familyIcon}
            aria-hidden="true"
          />
          <span sx={styles.familyName}>{family}</span>
        </div>
      ))}
    </div>
  )
}
