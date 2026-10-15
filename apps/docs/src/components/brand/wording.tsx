/**
 * Wording under review: headlines set in the heading face, descriptions as a lede would read, one
 * line against each alternative, and the voice they are written in. Each carries what it sells
 * and the page that backs it.
 */
import { css } from "@kirana-style/core"

import { Badge } from "@workspace/ui/components/badge"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
} from "@workspace/ui/tokens/typography"

import {
  AGAINST,
  DESCRIPTIONS,
  HEADLINES,
  IMPROVED_DESCRIPTIONS,
  IMPROVED_HEADLINES,
  VOICE,
} from "@/brand/wording"
import type { Line } from "@/brand/wording"
import { DocsLink } from "@/components/docs-link"

const styles = {
  stack: css({ display: "grid", gap: spacing[8] }),
  label: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  cells: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  cell: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    padding: spacing[6],
    backgroundColor: theme.background,
  }),
  head: css({ display: "flex", gap: spacing[2], alignItems: "center" }),
  number: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize.xs,
    color: theme.mutedForeground,
  }),
  headline: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["2xl"], [breakpoint.md]: fontSize["3xl"] },
    lineHeight: 1.15,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
    // An improved headline may carry its second line.
    whiteSpace: "pre-line",
  }),
  description: css({ fontSize: fontSize.lg, lineHeight: "1.6" }),
  proof: css({
    fontSize: fontSize.sm,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
  link: css({ color: theme.foreground, textUnderlineOffset: "3px" }),
  name: css({ fontWeight: fontWeight.semibold }),
  three: css({
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
}

function Cells({ lines, big }: { lines: Line[]; big?: boolean }) {
  return (
    <div sx={styles.cells}>
      {lines.map((line, index) => (
        <div key={line.text} sx={styles.cell}>
          <span sx={styles.head}>
            <span sx={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <Badge variant="outline">{line.tone}</Badge>
          </span>
          <span sx={big ? styles.headline : styles.description}>
            {line.text}
          </span>
          <span sx={styles.proof}>
            {line.proof}{" "}
            <DocsLink href={line.href} sx={styles.link}>
              Evidence
            </DocsLink>
          </span>
        </div>
      ))}
    </div>
  )
}

export function Wording() {
  return (
    <div sx={styles.stack}>
      <span sx={styles.label}>Improved headlines</span>
      <Cells lines={IMPROVED_HEADLINES} big />
      <span sx={styles.label}>Improved descriptions</span>
      <Cells lines={IMPROVED_DESCRIPTIONS} />
      <span sx={styles.label}>Headlines</span>
      <Cells lines={HEADLINES} big />
      <span sx={styles.label}>Descriptions</span>
      <Cells lines={DESCRIPTIONS} />
      <span sx={styles.label}>Against the alternatives</span>
      <div sx={styles.cells}>
        {AGAINST.map((item) => (
          <div key={item.name} sx={styles.cell}>
            <span sx={styles.name}>{item.name}</span>
            <span sx={styles.proof}>{item.text}</span>
          </div>
        ))}
      </div>
      <span sx={styles.label}>Voice</span>
      <div sx={[styles.cells, styles.three]}>
        {VOICE.map((item) => (
          <div key={item.title} sx={styles.cell}>
            <span sx={styles.name}>{item.title}</span>
            <span sx={styles.proof}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
