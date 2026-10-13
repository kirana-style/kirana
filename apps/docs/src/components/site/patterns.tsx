/**
 * The site's framing and background patterns. Every one is plain CSS in
 * Kirana, drawn in `currentColor` or in the subtree's accent, so light and dark
 * follow the colour scheme with no second rule.
 */
import { css, props as styleProps } from "@kirana-style/core"

import { tint } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { alpha, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

/** One seed of four ovals per 18 px tile; used as a mask, so it takes any colour. */
export const PETAL_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cg fill='%23000'%3E%3Cellipse cx='12.2' cy='9' rx='3.2' ry='2' transform='rotate(45 9 9)'/%3E%3Cellipse cx='12.2' cy='9' rx='3.2' ry='2' transform='rotate(135 9 9)'/%3E%3Cellipse cx='12.2' cy='9' rx='3.2' ry='2' transform='rotate(225 9 9)'/%3E%3Cellipse cx='12.2' cy='9' rx='3.2' ry='2' transform='rotate(315 9 9)'/%3E%3C/g%3E%3C/svg%3E")`

export const patterns = {
  /** Diagonal hatching in the text colour: set `color` to choose its strength. */
  hatch: css({
    color: alpha.foreground10,
    backgroundImage:
      "repeating-linear-gradient(-45deg, transparent 0 5px, currentColor 5px 6px)",
  }),
  dots: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `radial-gradient(circle, ${tint(45)} 1.2px, transparent 1.4px)`,
    backgroundSize: "14px 14px",
    maskImage: "linear-gradient(to bottom, black 20%, transparent 95%)",
  }),
  petals: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundColor: tint(40),
    maskImage: `${PETAL_TILE}, linear-gradient(to bottom, black 20%, transparent 95%)`,
    maskSize: "18px 18px, 100% 100%",
    maskRepeat: "repeat, no-repeat",
    maskComposite: "intersect",
  }),
  /** A soft glow in the accent, top left; place inside a `position: relative` box. */
  glow: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `radial-gradient(40% 60% at 0% 0%, ${tint(14)}, transparent 70%)`,
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
