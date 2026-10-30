/**
 * The site's calls to action, one shape everywhere: "Quick start" is a filled pill with the page's
 * scene in a round chip at its end; the secondary is the same pill outlined, with no chip. Both come
 * in the header's size (`sm`, 32 px) and a hero's (`lg`, 40 px), and 44 px on a touch screen. The
 * chip sits as far from the pill's end as from its top and bottom, so it is centred in the round end.
 */
import type { ReactElement, ReactNode } from "react"
import { css } from "@kirana-style/core"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint, pointer } from "@workspace/ui/tokens/breakpoints"
import { duration, easing, motion } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize, fontWeight } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { SCENES } from "@/brand/scenes"

import { useScene } from "./scene-context"

type Size = "sm" | "lg"

const styles = {
  pill: css({
    display: "inline-flex",
    alignItems: "center",
    minHeight: "auto",
    gap: spacing["2.5"],
    borderRadius: radius.full,
    lineHeight: 1,
    fontWeight: fontWeight.medium,
  }),
  sm: css({
    height: { base: spacing[8], [pointer.coarse]: spacing[11] },
    paddingInlineStart: spacing["3.5"],
    fontSize: fontSize.sm,
  }),
  lg: css({
    height: { base: spacing[10], [pointer.coarse]: spacing[11] },
    paddingInlineStart: spacing[4],
    fontSize: fontSize.sm,
  }),
  // Room for the chip at the end of the primary: its inset, less the border.
  primarySmEnd: css({
    paddingInlineEnd: { base: "4px", [pointer.coarse]: "5px" },
  }),
  primaryLgEnd: css({ paddingInlineEnd: "5px" }),
  // The secondary has no chip: the same padding on both sides.
  secondarySm: css({ paddingInlineEnd: spacing["3.5"] }),
  secondaryLg: css({ paddingInlineEnd: spacing[4] }),
  // Paper on paper in light mode, a shade off the night in dark: the scene's chip is the brightest
  // thing in it, and it never outweighs the hero's title or the logo. No shadow; a hairline border
  // that darkens, with the ground, on hover.
  primary: css({
    backgroundColor: {
      "*": null,
      base: `light-dark(${theme.card}, color-mix(in oklab, ${theme.foreground} 12%, ${theme.background}))`,
      ":hover": `light-dark(color-mix(in oklab, ${theme.foreground} 4%, ${theme.card}), color-mix(in oklab, ${theme.foreground} 17%, ${theme.background}))`,
    },
    borderColor: {
      base: `light-dark(color-mix(in oklab, ${theme.foreground} 16%, transparent), ${alpha.foreground10})`,
      ":hover": `color-mix(in oklab, ${theme.foreground} 26%, transparent)`,
    },
    color: theme.foreground,
    boxShadow: "none",
    transitionProperty: "background-color, border-color",
    transitionDuration: duration[200],
  }),
  secondary: css({
    backgroundColor: {
      "*": null,
      base: `color-mix(in oklab, ${theme.background} 60%, transparent)`,
      ":hover": alpha.muted50,
    },
    boxShadow: "none",
  }),
  chip: css({
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    borderRadius: radius.full,
    backgroundColor: accent.base,
    color: accent.on,
  }),
  chipSm: css({
    width: { base: "1.375rem", [pointer.coarse]: spacing[8] },
    height: { base: "1.375rem", [pointer.coarse]: spacing[8] },
  }),
  chipLg: css({
    width: { base: spacing[7], [pointer.coarse]: spacing[8] },
    height: { base: spacing[7], [pointer.coarse]: spacing[8] },
  }),
  // A small zoom in place: an arrow that steps sideways reads as the pill shifting under the pointer.
  arrow: css({
    scale: { base: "1", ":is(a:hover *)": "1.2" },
    transitionProperty: "scale",
    transitionDuration: { base: duration[200], [motion.reduce]: duration[0] },
    transitionTimingFunction: easing.emphasized,
  }),
  // The header's copy hides on the narrowest screens, where the menu sheet leads to the start.
  fromSm: css({ display: { base: "none", [breakpoint.sm]: "inline-flex" } }),
}

/** "Quick start", or another first step, as the filled pill with the scene's chip. */
export function QuickStart({
  size = "lg",
  href = "/docs/start/quick-start",
  children = "Quick start",
  hideOnPhone = false,
  sx,
  chipSx,
}: {
  size?: Size
  href?: string
  children?: ReactNode
  /** Hidden below `sm`, as in the header. */
  hideOnPhone?: boolean
  sx?: Sx
  /** The chip's colours, where the ground needs others (the closing section's night). */
  chipSx?: Sx
}) {
  const scene = useScene()
  return (
    <Button
      size={size}
      nativeButton={false}
      sx={[
        styles.pill,
        styles[size],
        size === "sm" ? styles.primarySmEnd : styles.primaryLgEnd,
        styles.primary,
        hideOnPhone && styles.fromSm,
        sx,
      ]}
      render={<DocsLink href={href} />}
    >
      {children}
      <span
        sx={[
          accents[SCENES[scene].hue],
          styles.chip,
          size === "sm" ? styles.chipSm : styles.chipLg,
          chipSx,
        ]}
      >
        <Icon
          icon={ArrowRight01Icon}
          size={size === "sm" ? "0.8125rem" : "0.9375rem"}
          sx={styles.arrow}
        />
      </span>
    </Button>
  )
}

/** The action beside "Quick start": the same pill, outlined. `render` is the link it draws on. */
export function SecondaryCta({
  size = "lg",
  render,
  children,
  sx,
}: {
  size?: Size
  render: ReactElement
  children: ReactNode
  sx?: Sx
}) {
  return (
    <Button
      size={size}
      variant="outline"
      nativeButton={false}
      sx={[
        styles.pill,
        styles[size],
        size === "sm" ? styles.secondarySm : styles.secondaryLg,
        styles.secondary,
        sx,
      ]}
      render={render}
    >
      {children}
    </Button>
  )
}
