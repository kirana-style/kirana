/**
 * The petal K as a construction drawing: its grid, Fibonacci circles, outline, joins, widths and
 * dimensions, each a layer. The mark page builds its steps from it, the brand page shows the full
 * drawing, and the homepage's blueprint card draws it in one colour.
 */
import { css } from "@kirana-style/core"

import { accent } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { fontFamily } from "@workspace/ui/tokens/typography"

import {
  CIRCLES,
  MARK,
  PAINT_ORDER,
  PARTS,
  REFERENCE,
  REFERENCE_TRANSFORM,
  WIDTH_CIRCLES,
  arcsOf,
  joints,
} from "@/brand/kirana-mark"
import type { Part } from "@/brand/kirana-mark"
import { KiranaMark } from "@/brand/kirana-mark-svg"
import type { MarkVariant } from "@/brand/kirana-mark-svg"

/** The reference's outline in comparisons: a red that reads on both schemes. */
export const REFERENCE_RED =
  "light-dark(oklch(0.58 0.22 20), oklch(0.7 0.19 20))"
/** One tint per part, for drawings and bars. */
export const PART_TINT: Record<Part, string> = {
  stem: "light-dark(oklch(0.78 0.12 65), oklch(0.72 0.12 65))",
  arm: "light-dark(oklch(0.74 0.12 25), oklch(0.68 0.12 25))",
  leg: "light-dark(oklch(0.55 0.15 265), oklch(0.62 0.14 265))",
}

/** The drawing's own colours, so it reads in both schemes. */
const colour = {
  plan: css({
    display: "block",
    width: "100%",
    height: "auto",
    overflow: "hidden",
    color: theme.foreground,
  }),
  grid: css({ stroke: theme.border }),
  gridMajor: css({ stroke: "light-dark(oklch(0.82 0 0), oklch(0.36 0 0))" }),
  circle: css({ stroke: accent.base, fill: "none" }),
  outline: css({ stroke: theme.foreground, fill: "none" }),
  ghost: css({ fill: "light-dark(oklch(0.9 0 0), oklch(0.27 0 0))" }),
  label: css({ fill: accent.base, fontFamily: fontFamily.numeric }),
  pointLabel: css({
    fill: theme.mutedForeground,
    fontFamily: fontFamily.numeric,
  }),
  smooth: css({
    fill: "light-dark(oklch(0.6 0.15 155), oklch(0.72 0.15 155))",
  }),
  tip: css({ fill: theme.background, stroke: REFERENCE_RED }),
  junction: css({ fill: theme.background, stroke: theme.foreground }),
  reference: css({ fill: "none", stroke: REFERENCE_RED }),
  widthCircle: css({
    fill: "none",
    stroke: theme.foreground,
    strokeDasharray: "3 3",
  }),
  dimension: css({ stroke: theme.mutedForeground, fill: "none" }),
}

/** The same layers in `currentColor` alone. */
const MONO = {
  plan: css({
    display: "block",
    width: "100%",
    height: "auto",
    overflow: "hidden",
  }),
  grid: css({ stroke: "currentColor", strokeOpacity: 0.14 }),
  gridMajor: css({ stroke: "currentColor", strokeOpacity: 0.3 }),
  circle: css({ stroke: "currentColor", fill: "none" }),
  outline: css({ stroke: "currentColor", fill: "none" }),
  ghost: css({ fill: "currentColor", fillOpacity: 0.12 }),
  label: css({ fill: "currentColor", fontFamily: fontFamily.numeric }),
  pointLabel: css({
    fill: "currentColor",
    fillOpacity: 0.8,
    fontFamily: fontFamily.numeric,
  }),
  smooth: css({ fill: "currentColor" }),
  tip: css({ fill: accent.base, stroke: "currentColor" }),
  junction: css({ fill: accent.base, stroke: "currentColor" }),
  dimension: css({ stroke: "currentColor", strokeOpacity: 0.7, fill: "none" }),
}

export type Layers = {
  grid?: boolean
  circles?: boolean
  labels?: boolean
  outline?: boolean
  ghost?: boolean
  joints?: boolean
  widths?: boolean
  fill?: MarkVariant | "tint" | null
  reference?: boolean
  dimensions?: boolean
}

const range = (n: number) => Array.from({ length: n + 1 }, (_, i) => i)
const ARCS = Object.values(PARTS).flatMap((d) => arcsOf(d))
const JOINTS = joints()
const PAD = 2

/**
 * The mark on its grid, with whichever construction layers are asked for. `mono` draws every line
 * in `currentColor`, for a drawing on a coloured ground such as the homepage's blueprint card.
 */
export function Plan({
  layers,
  label,
  mono,
  sx,
}: {
  layers: Layers
  label: string
  mono?: boolean
  sx?: Sx
}) {
  const { width: W, height: H } = MARK
  const styles = mono ? { ...colour, ...MONO } : colour
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
      sx={[styles.plan, sx]}
      role="img"
      aria-label={label}
    >
      {layers.grid ? (
        <g strokeWidth={1} vectorEffect="non-scaling-stroke">
          {range(W).map((x) => (
            <line
              key={`x${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={H}
              sx={x % 5 === 0 ? styles.gridMajor : styles.grid}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {[...range(Math.floor(H)), ...(H % 1 ? [H] : [])].map((y) => (
            <line
              key={`y${y}`}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              sx={y % 5 === 0 || y === H ? styles.gridMajor : styles.grid}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ) : null}
      {layers.ghost
        ? PAINT_ORDER.map((part) => (
            <path key={part} d={PARTS[part]} sx={styles.ghost} />
          ))
        : null}
      {layers.fill === "tint"
        ? PAINT_ORDER.map((part) => (
            <path key={part} d={PARTS[part]} fill={PART_TINT[part]} />
          ))
        : null}
      {layers.fill && layers.fill !== "tint" ? (
        <svg
          x={0}
          y={0}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          overflow="visible"
        >
          <KiranaMark variant={layers.fill} title={null} />
        </svg>
      ) : null}
      {layers.circles
        ? CIRCLES.map((c) => (
            <circle
              key={`${c.cx},${c.cy},${c.r}`}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              sx={styles.circle}
              strokeWidth={1}
              strokeOpacity={0.55}
              vectorEffect="non-scaling-stroke"
            />
          ))
        : null}
      {layers.outline
        ? PAINT_ORDER.map((part) => (
            <path
              key={part}
              d={PARTS[part]}
              sx={styles.outline}
              strokeWidth={1.75}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))
        : null}
      {layers.reference ? (
        <g transform={REFERENCE_TRANSFORM}>
          {Object.values(REFERENCE).map((d) => (
            <path
              key={d}
              d={d}
              sx={styles.reference}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ) : null}
      {layers.widths
        ? WIDTH_CIRCLES.map((c) => (
            <g key={c.part}>
              <circle
                cx={c.cx}
                cy={c.cy}
                r={MARK.stroke / 2}
                sx={styles.widthCircle}
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={c.cx}
                y={c.cy + 0.25}
                fontSize={0.85}
                textAnchor="middle"
                sx={styles.pointLabel}
              >
                5u
              </text>
            </g>
          ))
        : null}
      {layers.labels
        ? ARCS.filter(
            (a, i, all) =>
              all.findIndex(
                (b) =>
                  Math.hypot(a.mid[0] - b.mid[0], a.mid[1] - b.mid[1]) < 0.05
              ) === i
          ).map((a) => {
            // Label outside the curve: from the centre through the arc's midpoint.
            const len = Math.hypot(a.mid[0] - a.cx, a.mid[1] - a.cy)
            const at = [
              a.mid[0] + ((a.mid[0] - a.cx) / len) * 0.75,
              a.mid[1] + ((a.mid[1] - a.cy) / len) * 0.75,
            ]
            return (
              <text
                key={`${a.mid[0]},${a.mid[1]}`}
                x={at[0]}
                y={at[1]! + 0.2}
                fontSize={0.62}
                textAnchor="middle"
                sx={styles.label}
              >
                r{a.r}
              </text>
            )
          })
        : null}
      {layers.joints
        ? JOINTS.map((j) => (
            <circle
              key={`${j.x},${j.y}`}
              cx={j.x}
              cy={j.y}
              r={j.kind === "smooth" ? 0.16 : 0.24}
              sx={
                j.kind === "smooth"
                  ? styles.smooth
                  : j.kind === "tip"
                    ? styles.tip
                    : styles.junction
              }
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))
        : null}
      {layers.dimensions ? (
        <g fontSize={0.7} sx={styles.pointLabel}>
          <path
            d={`M-1 0V${H}M-1.3 0H-0.7M-1.3 ${H}H-0.7`}
            sx={styles.dimension}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={-1.3}
            y={H / 2}
            textAnchor="middle"
            transform={`rotate(-90 -1.3 ${H / 2})`}
          >
            {H}u
          </text>
          <path
            d={`M0 ${H + 1}H${W}M0 ${H + 0.7}V${H + 1.3}M${W} ${H + 0.7}V${H + 1.3}`}
            sx={styles.dimension}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text x={W / 2} y={H + 1.8} textAnchor="middle">
            16u
          </text>
        </g>
      ) : null}
    </svg>
  )
}
