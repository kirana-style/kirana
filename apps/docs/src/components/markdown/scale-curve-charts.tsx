/**
 * The scale curve as two line charts above its tables: build time, and CSS and JavaScript
 * gzipped, against the number of components, a line per tool. Hover or focus a size to read every
 * tool's value there; the tables under them keep each number with its interval.
 */
import { css } from "@kirana-style/core"
import { d3Curve, defineChart, lineY } from "@tanstack/charts"
import { scalePoint } from "@tanstack/charts/scales/point"
import { scaleLog } from "d3-scale"
import { curveMonotoneX } from "d3-shape"

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  chartTheme,
  chartTooltip,
} from "@workspace/ui/components/chart"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize } from "@workspace/ui/tokens/typography"

import {
  distinctConfig,
  toolColors,
  toolKey,
} from "@/components/site/tool-series"
import { SCALE_CURVE, TOOLS, formatValue, row } from "@/data/benchmarks"
import type { Corpus, Tool } from "@/data/benchmarks"

const styles = {
  charts: css({ display: "grid", gap: spacing[6], marginBlock: spacing[4] }),
  chart: css({ fontSize: fontSize.xs }),
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
 * How each tool's line is drawn: Kirana bold, whole and solid, so it reads first; the others
 * thinner, lighter and dashed, StyleX's SWC build dotted beside its Babel one's dashes, a shade
 * apart in one colour family.
 */
const STROKES: Record<Tool, { width: number; opacity: number; dash?: string }> =
  {
    Kirana: { width: 3, opacity: 1 },
    StyleX: { width: 1.75, opacity: 0.65, dash: "6 4" },
    "StyleX (SWC)": { width: 1.75, opacity: 0.65, dash: "1.5 3.5" },
    Tailwind: { width: 1.75, opacity: 0.65, dash: "6 4" },
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
            strokeOpacity: STROKES[tool].opacity,
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
        <ChartContainer
          key={entry.metric}
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
              formatter={(_, point) => (point.datum as { text: string }).text}
            />
          }
          legend={<ChartLegendContent />}
          sx={styles.chart}
        />
      ))}
    </div>
  )
}
