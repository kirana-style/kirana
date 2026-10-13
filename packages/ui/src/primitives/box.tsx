/**
 * Layer 5: the layout primitives.
 *
 * These give the design system the Panda-flavoured prop API — `<Box p="4"
 * bg="card" rounded="lg">` — while every prop resolves to a style the compiler
 * already compiled. No style object is built during render.
 *
 * Deliberately narrow: the props cover layout and the semantic palette, and
 * nothing else. Anything more specific belongs in a component's own
 * `css()`, where it is named and reviewable, rather than spread across
 * call sites as ad-hoc utilities.
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
