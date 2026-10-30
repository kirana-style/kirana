/**
 * The layout primitives. A prop like `<Box p="4" bg="card">` indexes a table of
 * styles compiled ahead of time, so no style object is built during render. The
 * props cover layout and the semantic palette only; anything more specific
 * belongs in a component's own `css()`, where it is named and reviewable.
 */

import type { Sx } from "../lib/sx"
import * as t from "./styles"

export type BoxProps = React.ComponentProps<"div"> & {
  /** Padding, on the Tailwind spacing scale. */
  p?: keyof typeof t.padding
  /** Inline (horizontal) padding. */
  px?: keyof typeof t.paddingInline
  /** Block (vertical) padding. */
  py?: keyof typeof t.paddingBlock
  bg?: keyof typeof t.bg
  color?: keyof typeof t.fg
  rounded?: keyof typeof t.rounded
  sx?: Sx
}

export function Box({ p, px, py, bg, color, rounded, sx, ...props }: BoxProps) {
  return (
    <div
      {...props}
      sx={[
        p && t.padding[p],
        px && t.paddingInline[px],
        py && t.paddingBlock[py],
        bg && t.bg[bg],
        color && t.fg[color],
        rounded && t.rounded[rounded],
        sx,
      ]}
    />
  )
}
