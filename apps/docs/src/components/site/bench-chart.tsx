/**
 * The benchmark from kirana-lab's newest run: one metric at a time,
 * the corpus total as a bar per tool and the three apps underneath. Bars grow
 * in when the chart is first seen; under reduced motion they are simply there.
 */
import { useRef, useState } from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { motion, useInView, useReducedMotion } from "motion/react"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import {
  APPS,
  BENCH,
  BENCH_DATE,
  BENCH_MACHINE,
  BENCH_RUN,
  METRICS,
  TOOLS,
} from "@/data/benchmarks"

const styles = {
  root: css({
    display: "grid",
    gap: spacing[5],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: spacing[5],
  }),
  metrics: css({ display: "flex", flexWrap: "wrap", gap: spacing[1] }),
  metric: css({
    borderRadius: radius.full,
    paddingInline: spacing[3],
    paddingBlock: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    cursor: "pointer",
    color: { base: theme.mutedForeground, "[aria-pressed=true]": accent.base },
    backgroundColor: { base: "transparent", "[aria-pressed=true]": tint(12) },
    transitionProperty: "color, background-color",
    transitionDuration: duration[150],
  }),
  rows: css({ display: "grid", gap: spacing[3] }),
  row: css({
    display: "grid",
    gridTemplateColumns: "6.5rem minmax(0, 1fr) 5.5rem",
    alignItems: "center",
    gap: spacing[3],
  }),
  tool: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
  track: css({
    height: spacing[6],
    borderRadius: radius.md,
    backgroundColor: theme.muted,
    overflow: "hidden",
  }),
  bar: css({
    height: "100%",
    borderRadius: radius.md,
    backgroundColor: tint(35),
  }),
  barOurs: css({ backgroundColor: accent.base }),
  value: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    textAlign: "end",
    fontVariantNumeric: "tabular-nums",
  }),
  apps: css({
    display: "grid",
    gridTemplateColumns: "6.5rem repeat(3, minmax(0, 1fr))",
    gap: spacing[3],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "dashed",
    borderBlockStartColor: theme.border,
    paddingBlockStart: spacing[3],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: "1.7",
    color: theme.mutedForeground,
    fontVariantNumeric: "tabular-nums",
  }),
  appHead: css({ color: theme.foreground, fontWeight: fontWeight.medium }),
  note: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

export function BenchChart() {
  const [id, setId] = useState(METRICS[0]!.id)
  const metric = METRICS.find((item) => item.id === id)!
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, margin: "-15% 0px" })
  const max = Math.max(...TOOLS.map((tool) => metric.total[tool]))
  const format = (value: number) =>
    value.toLocaleString("en", {
      minimumFractionDigits: metric.digits,
      maximumFractionDigits: metric.digits,
    })

  return (
    <figure sx={styles.root}>
      <div sx={styles.metrics} role="group" aria-label="Metric">
        {METRICS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === id}
            sx={styles.metric}
            onClick={() => setId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div ref={ref} sx={styles.rows}>
        {TOOLS.map((tool) => (
          <div key={tool} sx={styles.row}>
            <span sx={styles.tool}>{tool}</span>
            <div sx={styles.track}>
              <motion.div
                initial={reduce ? false : { width: 0 }}
                animate={{
                  width:
                    seen || reduce ? `${(metric.total[tool] / max) * 100}%` : 0,
                }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0, duration: 0.7 }
                }
                {...styleProps(
                  styles.bar,
                  tool === "Kirana" ? styles.barOurs : null
                )}
              />
            </div>
            <span sx={styles.value}>
              {format(metric.total[tool])} {metric.unit}
            </span>
          </div>
        ))}
      </div>
      <div sx={styles.apps}>
        <span />
        {APPS.map((app) => (
          <span key={app} sx={styles.appHead}>
            {app}
          </span>
        ))}
        {TOOLS.map((tool) => (
          <Row
            key={tool}
            tool={tool}
            values={metric.values[tool].map(format)}
          />
        ))}
      </div>
      <figcaption sx={styles.note}>
        {metric.note} Lower is better. Kirana {BENCH.meta.kirana} from npm, the
        median of {BENCH.meta.rounds.build} cold, interleaved builds on a{" "}
        {BENCH_MACHINE}, {BENCH_DATE}:{" "}
        <a href={BENCH_RUN} target="_blank" rel="noreferrer">
          the run
        </a>
        , and{" "}
        <DocsLink href="/docs/project/benchmarks">
          every measure with its confidence interval
        </DocsLink>
        .
      </figcaption>
    </figure>
  )
}

function Row({ tool, values }: { tool: string; values: readonly string[] }) {
  return (
    <>
      <span>{tool}</span>
      {values.map((value, i) => (
        <span key={i}>{value}</span>
      ))}
    </>
  )
}
