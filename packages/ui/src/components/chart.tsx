import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import * as RechartsPrimitive from "recharts"
import type { TooltipValueType } from "recharts"

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
 * Recharts draws its own SVG internals with its own fixed class names, which the
 * Tailwind version reached into with a dozen `[&_.recharts-*]` selectors. They
 * target markup this component does not own, by class names Kirana cannot hash,
 * so they live in `styles/globals.css` scoped under `[data-slot="chart"]`.
 *
 * Series colours changed mechanism as well. The original injected a `<style>` tag
 * containing a `.dark [data-chart=id]` rule, which no longer exists now that
 * theming goes through `createTheme`. Instead the colours are set as custom
 * properties directly on the container, where recharts' children inherit them —
 * no style tag, no `dangerouslySetInnerHTML`, and no dependence on a class name.
 *
 * A config entry with per-mode colours uses CSS `light-dark()`, which resolves
 * against the `color-scheme` the ThemeProvider sets.
 */

const THEMES = ["light", "dark"] as const
const INITIAL_DIMENSION = { width: 320, height: 200 } as const

type TooltipNameType = number | string

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

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const styles = {
  container: css({
    display: "flex",
    aspectRatio: "16 / 9",
    justifyContent: "center",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    // Read by the Recharts rules in globals.css, which cannot name a token.
    // The original's `stroke-border/50` grid, `stroke-border` reference lines
    // and cursor, `fill-muted-foreground` ticks and `fill-muted` cursor areas.
    "--chart-grid": alpha.border50,
    "--chart-line": theme.border,
    "--chart-muted": theme.mutedForeground,
    "--chart-fill": theme.muted,
  }),

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

function ChartContainer({
  id,
  sx,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
  initialDimension?: { width: number; height: number }
  sx?: Sx
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`
  const { className, style: compiledStyle } = styleProps(styles.container, sx)

  return (
    <ChartContext value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={className}
        style={{ ...compiledStyle, ...seriesColors(config), ...style }}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer
          initialDimension={initialDimension}
        >
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
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
}: Omit<React.ComponentProps<typeof RechartsPrimitive.Tooltip>, "className"> &
  Omit<React.ComponentProps<"div">, "className"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
    sx?: Sx
    labelSx?: Sx
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<
      TooltipValueType,
      TooltipNameType
    >,
    "accessibilityLayer"
  >) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === "string"
        ? (config[label]?.label ?? label)
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div sx={[styles.tooltipLabel, labelSx]}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return <div sx={[styles.tooltipLabel, labelSx]}>{value}</div>
  }, [label, labelFormatter, payload, hideLabel, labelSx, config, labelKey])

  if (!active || !payload?.length) {
    return null
  }

  // With a single series and a line or dashed marker, the label reads better
  // tucked beside the value than sitting above the whole tooltip.
  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div sx={[styles.tooltip, sx]}>
      {!nestLabel ? tooltipLabel : null}
      <div sx={styles.tooltipRows}>
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color ?? item.payload?.fill ?? item.color

            return (
              <div
                key={index}
                sx={[
                  styles.tooltipRow,
                  indicator === "dot" && styles.tooltipRowDot,
                ]}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          sx={[
                            styles.indicatorBase,
                            indicator === "dot" && styles.indicatorDot,
                            indicator === "line" && styles.indicatorLine,
                            indicator === "dashed" && styles.indicatorDashed,
                            nestLabel &&
                              indicator === "dashed" &&
                              styles.indicatorNested,
                            indicatorColor != null &&
                              styles.indicatorColor(String(indicatorColor)),
                          ]}
                        />
                      )
                    )}
                    <div
                      sx={[
                        styles.tooltipBody,
                        nestLabel
                          ? styles.tooltipBodyNested
                          : styles.tooltipBodyFlat,
                      ]}
                    >
                      <div sx={styles.tooltipNames}>
                        {nestLabel ? tooltipLabel : null}
                        <span sx={styles.tooltipName}>
                          {itemConfig?.label ?? item.name}
                        </span>
                      </div>
                      {item.value != null && (
                        <span sx={styles.tooltipValue}>
                          {typeof item.value === "number"
                            ? item.value.toLocaleString()
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  sx,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: Omit<React.ComponentProps<"div">, "className"> & {
  hideIcon?: boolean
  nameKey?: string
  sx?: Sx
} & RechartsPrimitive.DefaultLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      sx={[
        styles.legend,
        verticalAlign === "top" ? styles.legendTop : styles.legendBottom,
        sx,
      ]}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item, index) => {
          const key = `${nameKey ?? item.dataKey ?? "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div key={index} sx={styles.legendItem}>
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  sx={[
                    styles.legendSwatch,
                    item.color != null &&
                      styles.legendSwatchColor(String(item.color)),
                  ]}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config ? config[configLabelKey] : config[key]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
