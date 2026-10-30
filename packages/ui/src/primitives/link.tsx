/**
 * The Link primitive: an inline link is styled because it is a link, not by the
 * container it sits in.
 */

import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { theme } from "../theme/semantic"

const styles = {
  root: css({
    color: "inherit",
    textDecorationLine: "underline",
    textUnderlineOffset: "3px",
  }),
  hover: css({ color: { ":hover": theme.foreground } }),
  primaryHover: css({ color: { ":hover": theme.primary } }),
}

export type LinkProps = Omit<React.ComponentProps<"a">, "className"> & {
  /** Which colour the link moves toward on hover. */
  hover?: "foreground" | "primary"
  sx?: Sx
}

export function Link({ hover = "foreground", sx, ...props }: LinkProps) {
  return (
    <a
      {...props}
      sx={[
        styles.root,
        hover === "primary" ? styles.primaryHover : styles.hover,
        sx,
      ]}
    />
  )
}
