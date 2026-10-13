import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import * as t from "./styles"

const styles = {
  root: css({ display: "grid" }),
  placeCenter: css({ placeItems: "center" }),
}

export type GridProps = React.ComponentProps<"div"> & {
  columns?: keyof typeof t.columns
  gap?: keyof typeof t.gap
  align?: keyof typeof t.align
  justify?: keyof typeof t.justify
  p?: keyof typeof t.padding
  px?: keyof typeof t.paddingInline
  py?: keyof typeof t.paddingBlock
  bg?: keyof typeof t.bg
  rounded?: keyof typeof t.rounded
  /** Shorthand for `place-items: center`. */
  center?: boolean
  sx?: Sx
}

export function Grid({
  columns,
  gap,
  align,
  justify,
  p,
  px,
  py,
  bg,
  rounded,
  center,
  sx,
  ...props
}: GridProps) {
  return (
    <div
      {...props}
      sx={[
        styles.root,
        center && styles.placeCenter,
        columns && t.columns[columns],
        gap && t.gap[gap],
        align && t.align[align],
        justify && t.justify[justify],
        p && t.padding[p],
        px && t.paddingInline[px],
        py && t.paddingBlock[py],
        bg && t.bg[bg],
        rounded && t.rounded[rounded],
        sx,
      ]}
    />
  )
}
