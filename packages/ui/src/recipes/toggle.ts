/**
 * The Toggle recipe, shared by Toggle and ToggleGroupItem.
 *
 * `toggle-group.tsx` imported `toggleVariants` from `toggle.tsx` under Tailwind,
 * which is why the variant tables live here in `recipes/` rather than inside
 * either component.
 */

import { css } from "@kirana-style/core"

import { recipe } from "./recipe"
import { ctx } from "../theme/context"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const CLAMPED_MD_12 = `min(${radius.md}, 12px)`

const styles = {
  base: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    borderRadius: radius.lg,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    [ctx.iconSize]: "1rem",

    color: { ":hover": theme.foreground },
    borderColor: {
      base: "transparent",
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
    pointerEvents: { ":disabled": "none" },
    opacity: { ":disabled": 0.5 },
  }),

  /**
   * Each weight declares the whole background story, pressed state included.
   *
   * Styles merge per property, so a variant that set only `default` and `:hover`
   * would silently drop a pressed condition inherited from the base — which is
   * exactly how the selected item in a toggle group lost its highlight.
   *
   * `muted` in both modes: unlike Button, Toggle has no softer dark-mode hover.
   */
  default: css({
    backgroundColor: {
      base: "transparent",
      ":hover": theme.muted,
      '[aria-pressed="true"]': theme.muted,
      '[data-state="on"]': theme.muted,
    },
  }),
  outline: css({
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      base: theme.input,
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    backgroundColor: {
      base: "transparent",
      ":hover": theme.muted,
      '[aria-pressed="true"]': theme.muted,
      '[data-state="on"]': theme.muted,
    },
  }),

  defaultSize: css({
    height: spacing[8],
    minWidth: spacing[8],
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
  sm: css({
    height: spacing[7],
    minWidth: spacing[7],
    borderRadius: CLAMPED_MD_12,
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
    /**
     * `text-[0.8rem]` sat beside the base's `text-sm`, and `cn` resolved the
     * conflict by deleting `text-sm` — including the line-height that came with
     * it. The toggle then inherited its parent's line-height: 1.5 on the page,
     * the card's `text-sm` inside a card. Merging by property keeps the base's
     * line-height instead, so the loss has to be restated as `inherit`.
     */
    lineHeight: "inherit",
    [ctx.iconSize]: "0.875rem",
  }),
  lg: css({
    height: spacing[9],
    minWidth: spacing[9],
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
}

export const toggle = recipe({
  base: styles.base,
  variants: {
    variant: { default: styles.default, outline: styles.outline },
    size: { default: styles.defaultSize, sm: styles.sm, lg: styles.lg },
  },
  defaults: { variant: "default", size: "default" },
})
