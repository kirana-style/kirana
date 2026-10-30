import { useId } from "react"
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"

import { GRADIENTS, MARK, PAINT_ORDER, PARTS } from "./kirana-mark"
import type { Part } from "./kirana-mark"

export type MarkVariant = "brand" | "solid" | "mono" | "outline"

const styles = {
  root: css({ display: "block", flexShrink: 0, overflow: "visible" }),
}

/** How much of `currentColor` each part takes in the mono variant. The arm is painted last over the
 *  stem and the leg's tip, so it is the opaque one: a see-through arm would show them through it. */
const MONO: Record<keyof typeof PARTS, number> = {
  stem: 0.5,
  leg: 0.75,
  arm: 1,
}

/**
 * The petal K. `brand` draws the three brand gradients (`GRADIENTS`); `solid` fills every part with
 * `currentColor`; `mono` gives each part its own share of it; `outline` strokes the parts. Size it
 * with `height` (or `width`) in `sx`; the viewBox keeps the 16 × 21.5 proportions.
 */
export function KiranaMark({
  variant = "brand",
  title = "Kirana",
  height,
  stops,
  gap,
  sx,
}: {
  variant?: MarkVariant
  /** Gradient stops per part, in place of the brand's (a set from `PALETTES`). */
  stops?: Record<Part, [number, string][]>
  /**
   * The ground's colour: outlines the arm in it, under its fill, so where all three parts share
   * one colour a thin gap still separates them.
   */
  gap?: string
  /** A fixed height in px; otherwise size it with `sx`. */
  height?: number
  /** Accessible name; pass `null` when the text beside it already says it. */
  title?: string | null
  sx?: Sx
}) {
  const id = useId().replace(/:/g, "")
  const parts = PARTS
  const tall = MARK.height
  return (
    <svg
      viewBox={`0 0 ${MARK.width} ${tall}`}
      height={height}
      width={height ? (height * MARK.width) / tall : undefined}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      sx={[styles.root, sx]}
    >
      {variant === "brand" ? (
        <defs>
          {PAINT_ORDER.map((part) => {
            const g = GRADIENTS[part]
            return (
              <linearGradient
                key={part}
                id={`${id}-${part}`}
                gradientUnits="userSpaceOnUse"
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
              >
                {(stops?.[part] ?? g.stops).map(([offset, color]) => (
                  <stop key={offset} offset={offset} stopColor={color} />
                ))}
              </linearGradient>
            )
          })}
        </defs>
      ) : null}
      {PAINT_ORDER.map((part) => [
        gap && part === "arm" ? (
          <path
            key="gap"
            d={parts.arm}
            fill="none"
            stroke={gap}
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
        ) : null,
        <path
          key={part}
          d={parts[part]}
          fill={
            variant === "brand"
              ? `url(#${id}-${part})`
              : variant === "outline"
                ? "none"
                : "currentColor"
          }
          fillOpacity={variant === "mono" ? MONO[part] : undefined}
          // The stem and the arm meet along one edge; anti-aliasing would leave a hairline of the
          // surface there. A 0.2u stroke in the stem's own paint runs it under the arm and closes it.
          stroke={
            variant === "outline"
              ? "currentColor"
              : part === "stem" && variant !== "mono"
                ? variant === "brand"
                  ? `url(#${id}-stem)`
                  : "currentColor"
                : undefined
          }
          strokeWidth={
            variant === "outline"
              ? 0.18
              : part === "stem" && variant !== "mono"
                ? 0.2
                : undefined
          }
          strokeLinejoin="round"
        />,
      ])}
    </svg>
  )
}
