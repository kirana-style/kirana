import { createElement } from "react"
import { css, props as styleProps } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { fontFamily } from "../tokens/typography"
import * as t from "./styles"

/** The tags Text is allowed to render as. */
type TextElement =
  | "span"
  | "p"
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "label"
  | "strong"

const styles = {
  heading: css({ fontFamily: fontFamily.heading }),
  truncate: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  balance: css({ textWrap: "balance" }),
  pretty: css({ textWrap: "pretty" }),
}

/** `line-clamp-N`. Needs the webkit box properties, so it gets its own table. */
const clamp = {
  "1": css({
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }),
  "2": css({
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }),
  "3": css({
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }),
}

export type TextProps = React.ComponentProps<"span"> & {
  /** Which element to render. `span` by default. */
  as?: TextElement
  size?: keyof typeof t.size
  weight?: keyof typeof t.weight
  color?: keyof typeof t.fg
  leading?: keyof typeof t.lead
  /** Switches to the display typeface. */
  heading?: boolean
  truncate?: boolean
  clamp?: keyof typeof clamp
  wrap?: "balance" | "pretty"
  sx?: Sx
}

export function Text({
  as: Component = "span",
  size,
  weight,
  color,
  leading,
  heading,
  truncate,
  clamp: clampLines,
  wrap,
  sx,
  ...props
}: TextProps) {
  // `createElement` rather than `<Component>`: TypeScript intersects the props of
  // every tag in the union when a polymorphic component is written as JSX, which
  // makes no prop assignable.
  return createElement(Component, {
    ...props,
    ...styleProps(
      heading && styles.heading,
      size && t.size[size],
      weight && t.weight[weight],
      color && t.fg[color],
      leading && t.lead[leading],
      truncate && styles.truncate,
      clampLines && clamp[clampLines],
      wrap === "balance" && styles.balance,
      wrap === "pretty" && styles.pretty,
      sx
    ),
  })
}
