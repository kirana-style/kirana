/**
 * The benchmark from kirana-lab's newest run: one metric at a time, the corpus total as a bar per
 * tool with its value at the bar's end, and the three apps underneath. The bars are a TanStack
 * Charts definition, so the server renders them and a prerendered page shows them before any
 * script runs; switching the metric springs them to their new lengths, which reduced motion snaps.
 */
import { useMemo, useState } from "react"
import { css } from "@kirana-style/core"
import { barX, defineChart, text } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import {
  ChartContainer,
  ChartTooltipContent,
  chartTheme,
  chartTooltip,
} from "@workspace/ui/components/chart"
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
  highlightConfig,
  toolColors,
  toolKey,
} from "@/components/site/tool-series"
import {
  APPS,
  BENCH,
  BENCH_DATE,
  BENCH_MACHINE,
  BENCH_RUN,
  METRICS,
  TOOLS,
} from "@/data/benchmarks"
import type { Metric, Tool } from "@/data/benchmarks"

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
  chart: css({ fontFamily: fontFamily.sans, fontSize: fontSize.sm }),
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

const amount = (metric: Metric, value: number) =>
  `${value.toLocaleString("en", {
    minimumFractionDigits: metric.digits,
    maximumFractionDigits: metric.digits,
  })} ${metric.unit}`

const HEIGHT = 46 * TOOLS.length

function totals(metric: Metric) {
  const rows = TOOLS.map((tool) => ({
    tool,
    series: toolKey(tool),
    value: metric.total[tool],
    label: amount(metric, metric.total[tool]),
  }))
  return defineChart(
    {
      marks: [
        barX(rows, {
          id: "totals",
          x: "value",
          y: "tool",
          color: "series",
          radius: 6,
        }),
        text(rows, {
          id: "values",
          x: "value",
          y: "tool",
          text: "label",
          anchor: "start",
          dx: 8,
          fill: theme.foreground,
          fontSize: 13,
        }),
      ],
      scales: {
        x: { scale: scaleLinear, axis: false },
        y: {
          scale: () => scaleBand<Tool>().paddingInner(0.3).paddingOuter(0.1),
          axis: { line: false, ticks: { size: 0 } },
        },
      },
      color: toolColors,
      // Room for the tool names on the left and the longest value on the right.
      margin: { top: 0, right: 96, bottom: 0, left: 104 },
      // A bar is focused whole: a ring at its end would cover the value.
      theme: { ...chartTheme, focusRing: false },
    },
    {
      focus: "nearest-y",
      tooltip: { ...chartTooltip, anchor: "pointer" },
    }
  )
}

export function BenchChart() {
  const [id, setId] = useState(METRICS[0]!.id)
  const metric = METRICS.find((item) => item.id === id)!
  const definition = useMemo(() => totals(metric), [metric])
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
      <ChartContainer
        config={highlightConfig}
        definition={definition}
        ariaLabel={`${metric.label}, all three apps, by tool`}
        initialWidth={960}
        height={HEIGHT}
        motion
        tooltip={
          <ChartTooltipContent
            hideLabel
            nameKey="series"
            formatter={(value) => amount(metric, Number(value))}
          />
        }
        sx={styles.chart}
      />
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
