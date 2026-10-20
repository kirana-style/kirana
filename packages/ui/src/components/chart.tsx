import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import type { ChartPoint, ChartTheme, ChartValue } from "@tanstack/charts"
import { motion as chartMotion } from "@tanstack/charts/motion"
import type { ChartMotionOptions } from "@tanstack/charts/motion"
import { Chart, RendererChart } from "@tanstack/charts/react/tooltip"
import type { ChartProps } from "@tanstack/charts/react/tooltip"
import { tooltip } from "@tanstack/charts/tooltip"

import type { Sx } from "../lib/sx"
import { alpha, radius, theme } from "../theme/semantic"
import { shadow } from "../tokens/shadows"
import { spacing } from "../tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography"

/**
 * Charts on TanStack Charts, with shadcn's chart API around them: a `ChartConfig` that names and
 * colours each series, a `ChartContainer`, and `ChartTooltipContent` and `ChartLegendContent`.
 *
 * TanStack Charts renders the chart's SVG on the server and adopts it in the browser, so a
 * prerendered page shows the chart before any script runs. A chart is a definition
 * (`defineChart`, with marks and scales) rather than a tree of components: pass one to
 * `ChartContainer`, which sets the series colours, draws the tooltip body with
 * `ChartTooltipContent` and gives the chart the theme's colours.
 *
 * Series colours are custom properties on the container, `--color-<key>`, so a mark reads
 * `fill: "var(--color-desktop)"` as shadcn's charts do. A config entry with per-mode colours
 * uses CSS `light-dark()`, which resolves against the `color-scheme` the ThemeProvider sets.
 */

const THEMES = ["light", "dark"] as const

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<(typeof THEMES)[number], string> }
  )
>

type ChartContextValue = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextValue | null>(null)

/** The focused points the tooltip body shows, set by `ChartContainer` for each focus. */
const PointsContext = React.createContext<readonly ChartPoint[]>([])

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

/**
 * The chart's own colours, from the theme: the ticks and axis titles in the muted foreground and
 * the grid in the half-strength border, on no background. Give it to a definition as `theme`.
 */
export const chartTheme: ChartTheme = {
  foreground: theme.mutedForeground,
  muted: theme.mutedForeground,
  grid: alpha.border50,
  background: "transparent",
  palette: [
    theme.chart1,
    theme.chart2,
    theme.chart3,
    theme.chart4,
    theme.chart5,
  ],
}

/**
 * The tooltip extension, for a definition's `tooltip`. `ChartContainer` draws its body; its
 * surface is left without chrome, since the body brings its own.
 */
export const chartTooltip = { use: tooltip } as const

const styles = {
  container: css({
    display: "grid",
    justifyItems: "center",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    // The library's tooltip surface: `ChartTooltipContent` is the visible box.
    "--ts-chart-tooltip-background": "transparent",
    "--ts-chart-tooltip-border": "none",
    "--ts-chart-tooltip-shadow": "none",
    "--ts-chart-tooltip-padding": "0",
  }),
  chart: css({ width: "100%" }),

  tooltip: css({
    display: "grid",
    minWidth: spacing[32],
    alignItems: "start",
    gap: spacing["1.5"],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: alpha.border50,
    backgroundColor: theme.background,
    paddingInline: spacing["2.5"],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    boxShadow: shadow.xl,
  }),
  tooltipLabel: css({ fontWeight: fontWeight.medium }),
  tooltipRows: css({ display: "grid", gap: spacing["1.5"] }),
  tooltipRow: css({
    display: "flex",
    width: "100%",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: spacing[2],
  }),
  tooltipRowDot: css({ alignItems: "center" }),
  tooltipBody: css({
    display: "flex",
    flex: 1,
    justifyContent: "space-between",
    gap: spacing[4],
    lineHeight: 1,
  }),
  tooltipBodyNested: css({ alignItems: "flex-end" }),
  tooltipBodyFlat: css({ alignItems: "center" }),
  tooltipNames: css({ display: "grid", gap: spacing["1.5"] }),
  tooltipName: css({ color: theme.mutedForeground }),
  tooltipValue: css({
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
    fontVariantNumeric: "tabular-nums",
  }),

  indicatorBase: css({ flexShrink: 0, borderRadius: "2px" }),
  indicatorDot: css({ width: spacing["2.5"], height: spacing["2.5"] }),
  indicatorLine: css({ width: spacing[1] }),
  indicatorDashed: css({
    width: 0,
    borderWidth: "1.5px",
    borderStyle: "dashed",
    backgroundColor: "transparent",
  }),
  indicatorNested: css({ marginBlock: spacing["0.5"] }),
  /** The series colour, the one genuinely per-render value here. */
  indicatorColor: (value: string) =>
    css({
      backgroundColor: value,
      borderColor: value,
    }),

  legend: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
  }),
  legendTop: css({ paddingBottom: spacing[3] }),
  legendBottom: css({ paddingTop: spacing[3] }),
  legendItem: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["1.5"],
  }),
  legendSwatch: css({
    width: spacing[2],
    height: spacing[2],
    flexShrink: 0,
    borderRadius: "2px",
  }),
  legendSwatchColor: (value: string) => css({ backgroundColor: value }),
}

/** Builds the `--color-<key>` custom properties for a chart's series. */
function seriesColors(config: ChartConfig): React.CSSProperties {
  const vars: Record<string, string> = {}

  for (const [key, item] of Object.entries(config)) {
    if (item.theme) {
      // Resolved by the browser against the active `color-scheme`.
      vars[`--color-${key}`] =
        `light-dark(${item.theme.light}, ${item.theme.dark})`
    } else if (item.color) {
      vars[`--color-${key}`] = item.color
    }
  }

  return vars as React.CSSProperties
}

type ChartContainerProps<
  TDatum,
  TXValue extends ChartValue,
  TYValue extends ChartValue,
> = Omit<
  ChartProps<TDatum, TXValue, TYValue>,
  "className" | "style" | "renderTooltipBody"
> & {
  config: ChartConfig
  /**
   * The tooltip body, usually a `<ChartTooltipContent />`; it reads the focused points. Without
   * it, the library's own rows show. The definition must include `tooltip` (`chartTooltip`).
   */
  tooltip?: React.ReactNode
  /** Animate changes with TanStack Charts' springs; snapped under reduced motion. */
  motion?: boolean | ChartMotionOptions
  /** Under the chart, inside the container: a `<ChartLegendContent />`, which reads its colours. */
  legend?: React.ReactNode
  sx?: Sx
}

/**
 * The chart, its series colours and its tooltip. Size it as TanStack Charts sizes a chart:
 * `initialWidth` with `height` or `aspectRatio` for a responsive one, which the server renders at
 * that width and the browser at the container's.
 */
function ChartContainer<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>({
  config,
  tooltip: body,
  motion,
  legend,
  sx,
  ...chart
}: ChartContainerProps<TDatum, TXValue, TYValue>) {
  const renderer = React.useMemo(
    () =>
      motion
        ? chartMotion<TDatum, TXValue, TYValue>(
            motion === true ? undefined : motion
          )
        : undefined,
    [motion]
  )
  const renderTooltipBody = body
    ? ({
        points,
      }: {
        points: readonly ChartPoint<TDatum, TXValue, TYValue>[]
      }) => (
        <PointsContext.Provider value={points as readonly ChartPoint[]}>
          {body}
        </PointsContext.Provider>
      )
    : undefined
  const own = styleProps(styles.chart)
  const { className, style } = styleProps(styles.container, sx)
  // `renderSvg` customises the SVG renderer, which a renderer chart replaces.
  const { renderSvg: _svg, onRender: _render, ...common } = chart

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        className={className}
        style={{ ...style, ...seriesColors(config) }}
      >
        {renderer ? (
          <RendererChart
            {...common}
            {...own}
            renderer={renderer}
            renderTooltipBody={renderTooltipBody}
          />
        ) : (
          <Chart {...chart} {...own} renderTooltipBody={renderTooltipBody} />
        )}
        {legend}
      </div>
    </ChartContext.Provider>
  )
}

/**
 * A point's number and its category. A vertical bar or a line has its number on y; a horizontal
 * bar has it on x and its category on y.
 */
function valueOf(point: ChartPoint): ChartValue {
  return typeof point.yValue === "number" ? point.yValue : point.xValue
}
function categoryOf(point: ChartPoint): ChartValue {
  return typeof point.yValue === "number" ? point.xValue : point.yValue
}

/**
 * The config entry for a focused point: the datum's `nameKey` field when it has one, else the
 * point's series, else its mark's id.
 */
function pointConfig(config: ChartConfig, point: ChartPoint, nameKey?: string) {
  const field =
    nameKey && point.datum && typeof point.datum === "object"
      ? (point.datum as Record<string, unknown>)[nameKey]
      : undefined
  const name = String(field ?? point.group ?? point.markId)
  return { name, item: config[name] }
}

function ChartTooltipContent({
  sx,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelSx,
  formatter,
  color,
  nameKey,
  labelKey,
}: {
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  /** The heading; by default the focused x value, or its config label. */
  label?: React.ReactNode
  labelFormatter?: (
    label: React.ReactNode,
    points: readonly ChartPoint[]
  ) => React.ReactNode
  /** Formats a row's value; by default the number in the reader's locale. */
  formatter?: (value: ChartValue, point: ChartPoint) => React.ReactNode
  /** One indicator colour for every row, instead of each series' own. */
  color?: string
  /** The datum field that names a row's config entry, instead of the point's series. */
  nameKey?: string
  /** The config key whose label heads the tooltip. */
  labelKey?: string
  sx?: Sx
  labelSx?: Sx
}) {
  const { config } = useChart()
  const points = React.useContext(PointsContext)
  if (points.length === 0) return null

  const [first] = points
  const heading = hideLabel
    ? null
    : (label ??
      (labelKey
        ? config[labelKey]?.label
        : (config[String(categoryOf(first!))]?.label ??
          String(categoryOf(first!)))))
  const tooltipLabel =
    heading === null || heading === undefined ? null : (
      <div sx={[styles.tooltipLabel, labelSx]}>
        {labelFormatter ? labelFormatter(heading, points) : heading}
      </div>
    )

  // With a single series and a line or dashed marker, the label reads better
  // tucked beside the value than sitting above the whole tooltip.
  const nestLabel = points.length === 1 && indicator !== "dot"

  return (
    <div sx={[styles.tooltip, sx]}>
      {!nestLabel ? tooltipLabel : null}
      <div sx={styles.tooltipRows}>
        {points.map((point) => {
          const { name, item } = pointConfig(config, point, nameKey)
          const indicatorColor = color ?? point.color
          const value = valueOf(point)
          return (
            <div
              key={point.key}
              sx={[
                styles.tooltipRow,
                indicator === "dot" && styles.tooltipRowDot,
              ]}
            >
              {item?.icon ? (
                <item.icon />
              ) : hideIndicator ? null : (
                <div
                  sx={[
                    styles.indicatorBase,
                    indicator === "dot" && styles.indicatorDot,
                    indicator === "line" && styles.indicatorLine,
                    indicator === "dashed" && styles.indicatorDashed,
                    nestLabel &&
                      indicator === "dashed" &&
                      styles.indicatorNested,
                    styles.indicatorColor(indicatorColor),
                  ]}
                />
              )}
              <div
                sx={[
                  styles.tooltipBody,
                  nestLabel ? styles.tooltipBodyNested : styles.tooltipBodyFlat,
                ]}
              >
                <div sx={styles.tooltipNames}>
                  {nestLabel ? tooltipLabel : null}
                  <span sx={styles.tooltipName}>{item?.label ?? name}</span>
                </div>
                <span sx={styles.tooltipValue}>
                  {formatter
                    ? formatter(value, point)
                    : typeof value === "number"
                      ? value.toLocaleString()
                      : String(value)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The config's series, each with its colour: a legend beside or under the chart. */
function ChartLegendContent({
  sx,
  hideIcon = false,
  verticalAlign = "bottom",
  keys,
}: {
  hideIcon?: boolean
  verticalAlign?: "top" | "bottom"
  /** The series to list, in order; by default every config entry with a colour. */
  keys?: readonly string[]
  sx?: Sx
}) {
  const { config } = useChart()
  const entries = (keys ?? Object.keys(config)).filter(
    (key) => config[key]?.color || config[key]?.theme
  )
  if (entries.length === 0) return null

  return (
    <div
      sx={[
        styles.legend,
        verticalAlign === "top" ? styles.legendTop : styles.legendBottom,
        sx,
      ]}
    >
      {entries.map((key) => {
        const item = config[key]!
        return (
          <div key={key} sx={styles.legendItem}>
            {item.icon && !hideIcon ? (
              <item.icon />
            ) : (
              <div
                sx={[
                  styles.legendSwatch,
                  styles.legendSwatchColor(`var(--color-${key})`),
                ]}
              />
            )}
            {item.label}
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltipContent, ChartLegendContent, useChart }
