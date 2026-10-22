/**
 * The scale curve as two line charts above its tables: build time, and CSS and JavaScript
 * gzipped, against the number of components, a line per tool. Hover or focus a size to read every
 * tool's value there; the tables under them keep each number with its interval.
 */
import { css } from "@kirana-style/core"
import { d3Curve, defineChart, lineY } from "@tanstack/charts"
import { scalePoint } from "@tanstack/charts/scales/point"
import { ArrowDown02Icon } from "@hugeicons/core-free-icons"
import { scaleLog } from "d3-scale"
import { curveMonotoneX } from "d3-shape"

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  chartTheme,
  chartTooltip,
} from "@workspace/ui/components/chart"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import {
  distinctConfig,
  toolColors,
  toolKey,
} from "@/components/site/tool-series"
import { SCALE_CURVE, TOOLS, formatValue, row } from "@/data/benchmarks"
import type { Corpus, Tool } from "@/data/benchmarks"

const styles = {
  charts: css({ display: "grid", gap: spacing[6], marginBlock: spacing[4] }),
  figure: css({ display: "grid", gap: spacing[2] }),
  chart: css({ fontSize: fontSize.xs }),
  // The chart's title, and which way is better: every curve is a cost, so lower wins.
  head: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  title: css({ fontWeight: fontWeight.medium, color: theme.foreground }),
  better: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  // A column of its own, as wide as the longest ratio ("29.7× Kirana", in the tooltip's monospace
  // figures), and empty on Kirana's row, so every value ends at the same place.
  ratio: css({
    display: "inline-block",
    minWidth: "12ch",
    marginInlineStart: spacing["1.5"],
    textAlign: "start",
    color: theme.mutedForeground,
  }),
}

/** What a curve plots: its metric and the unit its axis reads in. */
const CURVES = [
  {
    metric: "build",
    title: "Build, cold",
    unit: "s",
    scale: 1 / 1000,
  },
  {
    metric: "totalGzip",
    title: "CSS + JavaScript, gzip",
    unit: "kB",
    scale: 1 / 1000,
  },
] as const

/**
 * How each tool's line is drawn: Kirana bold and solid, so it reads first; the others thin and
 * dashed in their softened colours (`distinctConfig`), StyleX's SWC build dotted beside its Babel
 * one's dashes. A line's points take its colour, so the three others' points match.
 */
const STROKES: Record<Tool, { width: number; dash?: string }> = {
  Kirana: { width: 3 },
  StyleX: { width: 1.5, dash: "6 4" },
  "StyleX (SWC)": { width: 1.5, dash: "1.5 3.5" },
  Tailwind: { width: 1.5, dash: "6 4" },
}

const corpus = (size: number) => `scale-curve/${size}` as Corpus
const sizeLabel = (size: number) => size.toLocaleString("en")

function curve(entry: (typeof CURVES)[number]) {
  const rows = SCALE_CURVE.flatMap((size) =>
    TOOLS.map((tool) => {
      const measured = row(corpus(size), "build", entry.metric, tool)
      return {
        tool,
        size: sizeLabel(size),
        series: toolKey(tool),
        value: measured.median * entry.scale,
        text: formatValue(measured.median, measured.unit),
        times:
          measured.median /
          row(corpus(size), "build", entry.metric, "Kirana").median,
      }
    })
  )
  return defineChart(
    {
      // Kirana last, so its line is drawn over the others where they cross.
      marks: [...TOOLS.slice(1), TOOLS[0]!].map((tool) =>
        lineY(
          rows.filter((datum) => datum.tool === tool),
          {
            id: `${entry.metric}-${toolKey(tool)}`,
            x: "size",
            y: "value",
            z: "series",
            color: "series",
            key: (datum) => `${datum.size}:${datum.series}`,
            strokeWidth: STROKES[tool].width,
            strokeDasharray: STROKES[tool].dash,
            // Through every measured point without overshooting one.
            curve: d3Curve(curveMonotoneX),
            lineCap: "round",
            points: true,
          }
        )
      ),
      scales: {
        x: {
          scale: () => scalePoint<string>().padding(0.4),
          axis: { line: false, ticks: { size: 0 }, label: "Components" },
        },
        // The sizes step tenfold and the times span two orders of magnitude: on a linear axis
        // every curve but the slowest lies flat along the bottom.
        y: {
          scale: scaleLog,
          grid: true,
          axis: { line: false, ticks: { size: 0 }, label: entry.unit },
        },
      },
      color: toolColors,
      margin: { top: 12, right: 16, bottom: 40, left: 56 },
      theme: chartTheme,
    },
    { focus: "group-x", tooltip: { ...chartTooltip, anchor: "group-center" } }
  )
}

const DEFINITIONS = CURVES.map((entry) => ({ entry, definition: curve(entry) }))

export function ScaleCurveCharts() {
  if (SCALE_CURVE.length === 0) return null
  return (
    <div sx={styles.charts}>
      {DEFINITIONS.map(({ entry, definition }) => (
        <figure key={entry.metric} sx={styles.figure}>
          <figcaption sx={styles.head}>
            <span sx={styles.title}>
              {entry.title}, in {entry.unit}
            </span>
            <span sx={styles.better}>
              <Icon icon={ArrowDown02Icon} size="0.875rem" />
              Lower is better
            </span>
          </figcaption>
          <ChartContainer
            config={distinctConfig}
            definition={definition}
            ariaLabel={`${entry.title}, by number of components, a line per tool`}
            initialWidth={720}
            height={260}
            tooltip={
              <ChartTooltipContent
                nameKey="series"
                labelFormatter={(size) =>
                  `${size} components, ${entry.title.toLowerCase()}`
                }
                formatter={(_, point) => {
                  const { text, times, tool } = point.datum as {
                    text: string
                    times: number
                    tool: Tool
                  }
                  return (
                    <>
                      {text}
                      <span sx={styles.ratio}>
                        {tool === "Kirana"
                          ? null
                          : `${times.toLocaleString("en", {
                              maximumFractionDigits: times < 10 ? 2 : 1,
                            })}× Kirana`}
                      </span>
                    </>
                  )
                }}
              />
            }
            legend={<ChartLegendContent />}
            sx={styles.chart}
          />
        </figure>
      ))}
    </div>
  )
}
