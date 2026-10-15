/**
 * The Button recipe: six weights × nine sizes, the densest variant set in the
 * design system.
 *
 * Notes on what changed from the Tailwind original:
 *
 *   - `[&_svg:not([class*='size-'])]:size-4` is gone. Each size declares
 *     `ctx.iconSize` and the `Icon` primitive reads it. Same result, and it no
 *     longer depends on inspecting a child's class attribute — impossible once
 *     class names are hashed.
 *   - `in-data-[slot=button-group]:rounded-lg` became a `within` read of the
 *     button-group relation.
 *   - `has-data-[icon=inline-end]:pe-2` became a plain `":has(…)"` key; no
 *     relation is needed to ask what an element contains.
 *   - Every `dark:` utility resolved into a `surface.*` token, because those
 *     were structural differences rather than palette swaps.
 */

import { css } from "@kirana-style/core"

import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { buttonGroupMarker } from "../theme/button-group-marker"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { pointer } from "../tokens/breakpoints"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/** `rounded-[min(var(--radius-md),10px)]` and its 12px sibling. */
const CLAMPED_MD_10 = `min(${radius.md}, 10px)`
const CLAMPED_MD_12 = `min(${radius.md}, 12px)`

/** A button inside a ButtonGroup squares off to its neighbours. */

const styles = {
  /**
   * The label inside a button, trimmed to its capital letters.
   *
   * A flex container centres the text's line box, but the capitals are not at
   * that box's centre. In the text face they sit up to 2px high once Chrome snaps the
   * baseline to a whole pixel, and how far depends on the button's sub-pixel
   * position on the page, so two identical buttons can look different.
   * `text-box` trims the box to cap height and baseline, so the capitals are
   * what gets centred. It needs an element: a bare text node has no box to trim,
   * which is why `Button` wraps its text. Browsers without `text-box` keep the
   * untrimmed rendering.
   */
  label: css({ textBox: "trim-both cap alphabetic" }),

  base: css({
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: "1px",
    borderStyle: "solid",
    backgroundClip: "padding-box",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
    outlineStyle: "none",
    userSelect: "none",
    transitionProperty:
      "color, background-color, border-color, box-shadow, translate",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    [ctx.iconSize]: "1rem",

    // `active:not-aria-[haspopup]:translate-y-px`: a plain button depresses on
    // press, but one that opens a menu does not, since the menu is the feedback.
    translate: {
      ":active": "0 1px",
      "[aria-haspopup]:active": null,
    },
    pointerEvents: { ":disabled": "none" },
    opacity: { ":disabled": 0.5 },
  }),

  // Focus and validation rings. Kept in one namespace per property so the
  // conditions cannot be clobbered by a variant that also sets them.
  ring: css({
    borderColor: {
      base: "transparent",
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
  }),

  // ── weights ──────────────────────────────────────────────────────────────
  default: css({
    backgroundColor: { base: theme.primary, ":hover": alpha.primary80 },
    color: theme.primaryForeground,
  }),
  outline: css({
    borderColor: {
      base: surface.outlineBorder,
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    backgroundColor: {
      base: surface.outlineBackground,
      ":hover": surface.outlineHover,
      // Hover still wins while open, as `dark:hover:bg-input/50` out-specifies
      // `aria-expanded:` in the original. An attribute key outranks `:hover`
      // on the precedence ladder, so the hover is nested inside it.
      '[aria-expanded="true"]': {
        base: surface.outlineExpanded,
        ":hover": surface.outlineHover,
      },
    },
    color: {
      ":hover": theme.foreground,
      '[aria-expanded="true"]': theme.foreground,
    },
  }),
  secondary: css({
    backgroundColor: {
      base: theme.secondary,
      // Was a raw `color-mix` in the class string: nudges the surface toward
      // the text colour rather than fading it, so it reads the same in both modes.
      ":hover": `color-mix(in oklch, ${theme.secondary}, ${theme.foreground} 5%)`,
      '[aria-expanded="true"]': theme.secondary,
    },
    color: theme.secondaryForeground,
  }),
  ghost: css({
    backgroundColor: {
      ":hover": surface.hover,
      '[aria-expanded="true"]': surface.hover,
    },
    color: {
      ":hover": theme.foreground,
      '[aria-expanded="true"]': theme.foreground,
    },
  }),
  destructive: css({
    backgroundColor: {
      base: surface.destructiveSoft,
      ":hover": surface.destructiveSoftHover,
    },
    color: theme.destructive,
    borderColor: {
      base: "transparent",
      ":focus-visible": alpha.destructive40,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${surface.ringInvalid}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
  }),
  link: css({
    color: theme.primary,
    textUnderlineOffset: "4px",
    textDecorationLine: { base: "none", ":hover": "underline" },
  }),

  // ── sizes ────────────────────────────────────────────────────────────────
  defaultSize: css({
    height: spacing[8],
    gap: spacing["1.5"],
    borderRadius: {
      base: radius.lg,
      [buttonGroupMarker.within('[data-slot="button-group"]')]: radius.lg,
    },
    paddingInline: spacing["2.5"],
    paddingInlineEnd: {
      base: spacing["2.5"],
      ':has([data-icon="inline-end"])': spacing[2],
    },
    paddingInlineStart: {
      base: spacing["2.5"],
      ':has([data-icon="inline-start"])': spacing[2],
    },
  }),
  xs: css({
    height: spacing[6],
    gap: spacing[1],
    borderRadius: {
      base: CLAMPED_MD_10,
      [buttonGroupMarker.within('[data-slot="button-group"]')]: radius.lg,
    },
    paddingInline: spacing[2],
    paddingInlineEnd: {
      base: spacing[2],
      ':has([data-icon="inline-end"])': spacing["1.5"],
    },
    paddingInlineStart: {
      base: spacing[2],
      ':has([data-icon="inline-start"])': spacing["1.5"],
    },
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    [ctx.iconSize]: "0.75rem",
  }),
  sm: css({
    height: spacing[7],
    gap: spacing[1],
    borderRadius: {
      base: CLAMPED_MD_12,
      [buttonGroupMarker.within('[data-slot="button-group"]')]: radius.lg,
    },
    paddingInline: spacing["2.5"],
    paddingInlineEnd: {
      base: spacing["2.5"],
      ':has([data-icon="inline-end"])': spacing["1.5"],
    },
    paddingInlineStart: {
      base: spacing["2.5"],
      ':has([data-icon="inline-start"])': spacing["1.5"],
    },
    fontSize: "0.8rem",
    // `text-[0.8rem]` made `cn` delete the base's `text-sm`, line-height and
    // all, so the original inherits its parent's: restated, as Toggle does.
    // Without it, text that is not a trimmed label sat half a pixel high.
    lineHeight: "inherit",
    [ctx.iconSize]: "0.875rem",
  }),
  // A call to action: 44 px tall on a touch screen.
  lg: css({
    height: { base: spacing[9], [pointer.coarse]: "2.75rem" },
    gap: spacing["1.5"],
    borderRadius: {
      base: radius.lg,
      [buttonGroupMarker.within('[data-slot="button-group"]')]: radius.lg,
    },
    paddingInline: spacing["2.5"],
    paddingInlineEnd: {
      base: spacing["2.5"],
      ':has([data-icon="inline-end"])': spacing[2],
    },
    paddingInlineStart: {
      base: spacing["2.5"],
      ':has([data-icon="inline-start"])': spacing[2],
    },
  }),
  icon: css({
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.lg,
  }),
  iconXs: css({
    width: spacing[6],
    height: spacing[6],
    borderRadius: {
      base: CLAMPED_MD_10,
      [buttonGroupMarker.within('[data-slot="button-group"]')]: radius.lg,
    },
    [ctx.iconSize]: "0.75rem",
  }),
  iconSm: css({
    width: spacing[7],
    height: spacing[7],
    borderRadius: {
      base: CLAMPED_MD_12,
      [buttonGroupMarker.within('[data-slot="button-group"]')]: radius.lg,
    },
    // Unlike `sm`, the original `icon-sm` has no icon-size rule: its icon stays
    // at the base 1rem.
    [ctx.iconSize]: "1rem",
  }),
  iconLg: css({
    width: spacing[9],
    height: spacing[9],
    borderRadius: radius.lg,
  }),
}

export const button = recipe({
  base: styles.base,
  variants: {
    variant: {
      default: styles.default,
      outline: styles.outline,
      secondary: styles.secondary,
      ghost: styles.ghost,
      destructive: styles.destructive,
      link: styles.link,
    },
    size: {
      default: styles.defaultSize,
      xs: styles.xs,
      sm: styles.sm,
      lg: styles.lg,
      icon: styles.icon,
      "icon-xs": styles.iconXs,
      "icon-sm": styles.iconSm,
      "icon-lg": styles.iconLg,
    },
  },
  defaults: { variant: "default", size: "default" },
})

/**
 * The ring has to be applied before the weight variant, so a weight that
 * redefines `borderColor` or `boxShadow` (outline, destructive) wins.
 */
export const buttonRing = styles.ring

/** For text passed to a Button as an element rather than a string. */
export const buttonLabel = styles.label
