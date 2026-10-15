/**
 * "Measured": the homepage's one place for numbers. Every figure is in `HEADLINES`, derived from
 * or copied out of the benchmark notes with the section it comes from, so a number on the homepage
 * always has a source and is never typed twice.
 */
import { css } from "@kirana-style/core"

import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { chapter } from "@/components/site/chapter"
import { InlineCode } from "@/components/site/code-tokens"
import { BENCH_SOURCE, HEADLINES } from "@/data/benchmarks"

import { HomeSection } from "./frame"

const styles = {
  grid: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderBlockWidth: "1px",
    borderBlockStyle: "solid",
    borderBlockColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  cell: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    paddingBlock: { base: spacing[6], [breakpoint.md]: spacing[8] },
    paddingInline: { base: 0, [breakpoint.sm]: spacing[6] },
    backgroundColor: theme.background,
  }),
  value: css({
    fontFamily: fontFamily.numeric,
    fontSize: { base: fontSize["3xl"], [breakpoint.md]: fontSize["4xl"] },
    lineHeight: "1",
    fontWeight: fontWeight.medium,
    letterSpacing: "-0.02em",
    color: theme.foreground,
  }),
  label: css({
    maxWidth: "22rem",
    fontSize: fontSize.sm,
    lineHeight: "1.55",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  source: css({
    fontFamily: fontFamily.mono,
    fontSize: textSize.micro,
    lineHeight: textLeading.micro,
    letterSpacing: textTracking.micro,
    color: theme.mutedForeground,
  }),
  note: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

export function Proof() {
  return (
    <HomeSection
      id="measured"
      number="04"
      eyebrow="Measured"
      title="Measured on the same three applications"
      lede="Kirana, the StyleX port and the Tailwind original of one set of applications, built and run on one machine. Advisory numbers, each with the measurement it comes from."
      aside={
        <DocsLink href="/blog/what-we-measured" sx={chapter.aside}>
          How we measured
        </DocsLink>
      }
    >
      <div sx={styles.grid}>
        {HEADLINES.map((headline) => (
          <div key={headline.id} sx={styles.cell}>
            <span sx={styles.value}>{headline.value}</span>
            <span sx={styles.label}>{headline.label}</span>
            <span sx={styles.source}>{headline.source}</span>
          </div>
        ))}
      </div>
      <p sx={styles.note}>
        Each figure names where it comes from: a section of{" "}
        <InlineCode>{BENCH_SOURCE}</InlineCode>, or a design note beside it.
        Those files give the machine, the date and the commands.
      </p>
    </HomeSection>
  )
}
