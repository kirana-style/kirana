/**
 * The site's framing and background patterns. Every one is plain CSS in
 * Kirana, drawn in `currentColor` or in the subtree's accent, so light and dark
 * follow the colour scheme with no second rule.
 */
import { css, props as styleProps } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"
import { alpha, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

export const patterns = {
  /** Diagonal hatching in the text colour: set `color` to choose its strength. */
  hatch: css({
    color: alpha.foreground10,
    backgroundImage:
      "repeating-linear-gradient(-45deg, transparent 0 5px, currentColor 5px 6px)",
  }),
}

const styles = {
  rail: css({
    position: "relative",
    width: "100%",
    maxWidth: "80rem",
    marginInline: "auto",
    borderInlineWidth: { base: "0", [breakpoint.md]: "1px" },
    borderInlineStyle: "solid",
    borderInlineColor: theme.border,
  }),
  band: css({ height: { base: spacing[8], [breakpoint.sm]: spacing[9] } }),
  bandOuter: css({
    borderBlockWidth: "1px",
    borderBlockStyle: "solid",
    borderBlockColor: theme.border,
  }),
}

/** The page's frame: a centred column with vertical rules either side. */
export function Rail({
  as: Tag = "div",
  sx,
  children,
  id,
}: {
  as?: "div" | "section" | "header" | "footer" | "main"
  sx?: Sx
  children?: React.ReactNode
  id?: string
}) {
  return (
    // A dynamic tag is not a host element the compiler can see, so the styles
    // are spread as props.
    <Tag id={id} {...styleProps(styles.rail, sx)}>
      {children}
    </Tag>
  )
}

/** An empty strip between sections, ruled top and bottom, hatched inside the rail. */
export function Band() {
  return (
    <div sx={styles.bandOuter} aria-hidden="true">
      <Rail sx={[styles.band, patterns.hatch]} />
    </div>
  )
}
