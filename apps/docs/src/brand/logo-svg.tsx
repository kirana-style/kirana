import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"

import { MARK } from "./kirana-mark"
import { KiranaMark } from "./kirana-mark-svg"
import { COLOURS, ICON, LOCKUPS, placement } from "./logo"
import type { Lockup, Variant } from "./logo"

const styles = {
  root: css({ display: "block", flexShrink: 0 }),
}

/**
 * A logo file drawn inline, laid out as `toSvg` writes it: the tile, then the
 * petal K in its place. Size it with `height` (or `width`) in `sx`.
 */
export function LogoSvg({
  lockup,
  variant,
  title = "Kirana",
  sx,
}: {
  lockup: Lockup
  variant: Variant
  /** Accessible name; pass `null` when the text beside it already says it. */
  title?: string | null
  sx?: Sx
}) {
  const { width, height } = LOCKUPS[lockup]
  const { scale, x, y } = placement(lockup)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      sx={[styles.root, sx]}
    >
      {variant.backdrop ? (
        <rect
          width={width}
          height={height}
          rx={ICON.radius}
          fill={variant.backdrop}
        />
      ) : null}
      <svg
        x={x}
        y={y}
        width={MARK.width * scale}
        height={MARK.height * scale}
        viewBox={`0 0 ${MARK.width} ${MARK.height}`}
        overflow="visible"
        color={
          variant.paint === "brand" ? undefined : COLOURS[variant.paint].hex
        }
      >
        <KiranaMark
          variant={variant.paint === "brand" ? "brand" : "solid"}
          title={null}
        />
      </svg>
    </svg>
  )
}
