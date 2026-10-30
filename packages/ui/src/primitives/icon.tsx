/**
 * The Icon primitive. It sizes itself from `ctx.iconSize`, which the surrounding
 * control sets (`{ [ctx.iconSize]: "0.875rem" }`); an explicit `size` prop wins.
 */

import { css, props as styleProps } from "@kirana-style/core"
import { HugeiconsIcon } from "@hugeicons/react"

import type { Sx } from "../lib/sx"
import { ctx } from "../theme/context"

const styles = {
  root: css({
    // Inherits whatever the nearest control declared, falling back to 1rem.
    width: ctx.iconSize,
    height: ctx.iconSize,
    flexShrink: 0,
    // Icons are decoration inside controls; the control owns the interaction.
    pointerEvents: "none",
  }),
  explicit: (value: string) => css({ width: value, height: value }),
}

export type IconProps = Omit<
  React.ComponentProps<typeof HugeiconsIcon>,
  "className" | "size" | "width" | "height"
> & {
  /** Overrides the size the surrounding control asked for. */
  size?: string
  sx?: Sx
}

/**
 * `strokeWidth` defaults to 2, not Hugeicons' own 1.5, to match the lucide
 * glyphs shadcn's components are drawn with.
 */
export function Icon({ size, sx, strokeWidth = 2, ...props }: IconProps) {
  return (
    <HugeiconsIcon
      aria-hidden
      strokeWidth={strokeWidth}
      {...props}
      {...styleProps(styles.root, size != null && styles.explicit(size), sx)}
    />
  )
}
