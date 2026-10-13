/**
 * Layer 5: the Link primitive.
 *
 * The old components styled anchors from their ancestors — `[&_a]:underline
 * [&_a]:hover:text-foreground` appeared in Alert, AlertDescription and
 * EmptyDescription. The StyleX port had no descendant selectors, so inline
 * links became a component, and the component stayed.
 *
 * That trade reads better anyway: a link is now styled because it is a link,
 * not because of which container it happens to sit inside.
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
