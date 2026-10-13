import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import * as t from "./styles"

const styles = {
  root: css({ display: "flex" }),
  inline: css({ display: "inline-flex" }),
  grow: css({ flexGrow: 1 }),
}

export type FlexProps = React.ComponentProps<"div"> & {
  direction?: keyof typeof t.direction
  align?: keyof typeof t.align
  justify?: keyof typeof t.justify
  wrap?: keyof typeof t.wrap
  gap?: keyof typeof t.gap
  p?: keyof typeof t.padding
  px?: keyof typeof t.paddingInline
  py?: keyof typeof t.paddingBlock
  bg?: keyof typeof t.bg
  color?: keyof typeof t.fg
  rounded?: keyof typeof t.rounded
  /** Renders `inline-flex` instead of `flex`. */
  inline?: boolean
  grow?: boolean
  sx?: Sx
}

export function Flex({
  direction,
  align,
  justify,
  wrap,
  gap,
  p,
  px,
  py,
  bg,
  color,
  rounded,
  inline,
  grow,
  sx,
  ...props
}: FlexProps) {
  return (
    <div
      {...props}
      sx={[
        inline ? styles.inline : styles.root,
        grow && styles.grow,
        direction && t.direction[direction],
        align && t.align[align],
        justify && t.justify[justify],
        wrap && t.wrap[wrap],
        gap && t.gap[gap],
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
