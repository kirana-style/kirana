/**
 * The site's calls to action, one shape everywhere: "Quick start" is a raised pill with the page's
 * scene in a round chip at its end, the arrow in it stepping forward on hover; the secondary one
 * beside it is the same pill outlined, quieter, with no chip. Both come in the header's size (`sm`,
 * 36 px) and a hero's (`lg`, 44 px), and grow to a finger's size on a touch screen.
 *
 * The chip sits 6px from the pill's top, end and bottom, so it is centred in the pill's round end.
 * The button's 1px border sits outside its padding, so the end padding is one pixel less.
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
    height: { base: spacing[9], [pointer.coarse]: spacing[11] },
    paddingInlineStart: spacing[4],
    fontSize: fontSize.sm,
  }),
  lg: css({
    height: { base: spacing[11], [pointer.coarse]: spacing[12] },
    paddingInlineStart: spacing[5],
    fontSize: fontSize.base,
  }),
  // Room for the chip at the end of the primary.
  primaryEnd: css({ paddingInlineEnd: `calc(${spacing["1.5"]} - 1px)` }),
  // The secondary has no chip: the same padding on both sides.
  secondarySm: css({ paddingInlineEnd: spacing[4] }),
  secondaryLg: css({ paddingInlineEnd: spacing[5] }),
  // A raised surface a shade off the page in both schemes, not an ink or white pill: the scene's
  // chip is the brightest thing in it, and it never outweighs the hero's title or the logo. A soft
  // inner highlight and a lift on hover set it apart from quiet buttons.
  primary: css({
    backgroundColor: {
      "*": null,
      base: `light-dark(color-mix(in oklab, ${theme.foreground} 7%, ${theme.background}), color-mix(in oklab, ${theme.foreground} 12%, ${theme.background}))`,
      ":hover": `light-dark(color-mix(in oklab, ${theme.foreground} 11%, ${theme.background}), color-mix(in oklab, ${theme.foreground} 18%, ${theme.background}))`,
    },
    borderColor: alpha.foreground10,
    color: theme.foreground,
    boxShadow: {
      base: `inset 0 1px 0 ${alpha.background20}, 0 1px 2px ${alpha.foreground10}`,
      ":hover": `inset 0 1px 0 ${alpha.background20}, 0 4px 12px ${alpha.foreground10}`,
    },
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  secondary: css({
    backgroundColor: {
      "*": null,
      base: `color-mix(in oklab, ${theme.background} 60%, transparent)`,
      ":hover": alpha.muted50,
    },
    boxShadow: `0 1px 2px ${alpha.foreground10}`,
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
    width: { base: spacing[6], [pointer.coarse]: spacing[8] },
    height: { base: spacing[6], [pointer.coarse]: spacing[8] },
  }),
  chipLg: css({
    width: { base: spacing[8], [pointer.coarse]: spacing[9] },
    height: { base: spacing[8], [pointer.coarse]: spacing[9] },
  }),
  arrow: css({
    translate: { base: "0 0", ":is(a:hover *)": "2px 0" },
    transitionProperty: "translate",
    transitionDuration: { base: duration[200], [motion.reduce]: duration[0] },
    transitionTimingFunction: easing.emphasized,
  }),
  // The header's copy hides on the narrowest screens, where the menu sheet leads to the start.
  fromSm: css({ display: { base: "none", [breakpoint.sm]: "inline-flex" } }),
}

/** "Quick start", or another first step, as the raised pill with the scene's chip. */
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
        styles.primaryEnd,
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
          size={size === "sm" ? "0.875rem" : "1rem"}
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
