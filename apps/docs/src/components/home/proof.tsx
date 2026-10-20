/**
 * "Measured": the homepage's one place for numbers. The chart is the compiler page's, from
 * kirana-lab's newest run; every other figure is in `HEADLINES`, worded from that run or, for the
 * editor, from the design note it names, so a number on the homepage always links where it was
 * measured and is never typed twice.
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
import { BenchChart } from "@/components/site/bench-chart"
import { chapter } from "@/components/site/chapter"
import { BENCH, HEADLINES, LAB } from "@/data/benchmarks"
import { GITHUB } from "@/data/links"

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
    justifySelf: "start",
    fontFamily: fontFamily.mono,
    fontSize: textSize.micro,
    lineHeight: textLeading.micro,
    letterSpacing: textTracking.micro,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
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
      lede={`Kirana ${BENCH.meta.kirana}, the StyleX port and the Tailwind original of one set of applications, built and run in public by kirana-lab on every release. Each figure links the run it comes from.`}
      aside={
        <DocsLink href="/docs/project/benchmarks" sx={chapter.aside}>
          How we measured
        </DocsLink>
      }
    >
      <BenchChart />
      <div sx={styles.grid}>
        {HEADLINES.map((headline) => (
          <div key={headline.id} sx={styles.cell}>
            <span sx={styles.value}>{headline.value}</span>
            <span sx={styles.label}>{headline.label}</span>
            <a
              href={
                headline.link.startsWith("https:")
                  ? headline.link
                  : `${GITHUB}/blob/main/${headline.link}`
              }
              target="_blank"
              rel="noreferrer"
              sx={styles.source}
            >
              {headline.source}
            </a>
          </div>
        ))}
      </div>
      <p sx={styles.note}>
        The build and browser figures are medians from{" "}
        <a href={LAB} target="_blank" rel="noreferrer">
          kirana-lab
        </a>
        , each claimed only where its 95 % confidence interval shows a
        difference. Every measure, including where Kirana is behind, is on the{" "}
        <DocsLink href="/docs/project/benchmarks">benchmarks page</DocsLink>.
        The editor figures are from one developer machine, in the design note
        each links.
      </p>
    </HomeSection>
  )
}
