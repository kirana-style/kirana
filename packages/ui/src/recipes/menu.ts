/**
 * Shared surface and row styling for every menu-shaped popup: DropdownMenu,
 * ContextMenu, Menubar, Select and Combobox. Rows style themselves; the popup
 * hands down only the colours that differ between its solid and glass surfaces,
 * through `menuCtx`.
 */

import { css } from "@kirana-style/core"

import { recipe } from "./recipe"
import { ctx, menuCtx } from "../theme/context"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { blur } from "../tokens/blur"
import { shadow } from "../tokens/shadows"
import { spacing } from "../tokens/spacing"
import {
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

export const menuStyles = {
  /** The positioner, which owns stacking but paints nothing. */
  positioner: css({
    isolation: "isolate",
    zIndex: zIndex.popover,
    outlineStyle: "none",
  }),

  /**
   * The popup surface, solid by default. `glass` below turns it translucent.
   * Either way the popup declares how its rows highlight, through `menuCtx`.
   */
  content: css({
    zIndex: zIndex.popover,
    maxHeight: "var(--available-height)",
    minWidth: spacing[32],
    overflowX: "hidden",
    overflowY: "auto",
    borderRadius: radius.lg,
    backgroundColor: theme.popover,
    padding: spacing[1],
    color: theme.popoverForeground,
    /**
     * `shadow-md ring-1 ring-foreground/10`. The ring layer is listed first, as
     * Tailwind composes it, so it paints on top. `shadow.md` is two layers.
     */
    boxShadow: `0 0 0 1px ${alpha.foreground10}, ${shadow.md}`,
    outlineStyle: "none",
    [ctx.iconSize]: "1rem",
    [menuCtx.highlight]: theme.accent,
    [menuCtx.destructiveColor]: theme.destructive,
    [menuCtx.destructiveHighlight]: surface.destructiveSoft,
    [menuCtx.separator]: theme.border,
  }),
  /**
   * A translucent panel over a blurred backdrop: DropdownMenu, Select and
   * Combobox. Apply after `content`. The blur sits on a `::before` layer rather
   * than the popup itself, so the panel's own text stays sharp.
   */
  glass: css({
    // Positions the blurred `::before` layer.
    position: "relative",
    backgroundColor: alpha.popover70,
    [menuCtx.highlight]: alpha.foreground10,
    [menuCtx.destructiveColor]: theme.accentForeground,
    [menuCtx.destructiveHighlight]: alpha.foreground10,
    [menuCtx.separator]: alpha.foreground5,
    "::before": {
      content: "''",
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      zIndex: -1,
      borderRadius: "inherit",
      backdropFilter: `blur(${blur["2xl"]}) saturate(150%)`,
    },
  }),
  /** A submenu sizes to its own content rather than matching its anchor. */
  submenu: css({ width: "auto", minWidth: "96px" }),
  /** The top-level popup matches the width of the control that opened it. */
  anchored: css({ width: "var(--anchor-width)" }),

  /** A selectable row. */
  itemBase: css({
    position: "relative",
    display: "flex",
    cursor: "default",
    alignItems: "center",
    gap: spacing["1.5"],
    borderRadius: radius.md,
    paddingInline: spacing["1.5"],
    paddingBlock: spacing[1],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    userSelect: "none",
    pointerEvents: { "[data-disabled]": "none" },
    opacity: { "[data-disabled]": 0.5 },
  }),
  itemDefault: css({
    backgroundColor: {
      ":focus": menuCtx.highlight,
      "[data-highlighted]": menuCtx.highlight,
      '[data-popup-open="true"]': menuCtx.highlight,
      "[data-open]": menuCtx.highlight,
    },
    color: {
      ":focus": theme.accentForeground,
      "[data-highlighted]": theme.accentForeground,
      "[data-open]": theme.accentForeground,
    },
  }),
  itemDestructive: css({
    color: menuCtx.destructiveColor,
    backgroundColor: {
      ":focus": menuCtx.destructiveHighlight,
      "[data-highlighted]": menuCtx.destructiveHighlight,
    },
  }),
  /** Leaves room for a leading indicator column. */
  itemInset: css({ paddingInlineStart: spacing[7] }),
  /** Leaves room for a trailing check. */
  itemCheckable: css({
    paddingInlineStart: spacing["1.5"],
    paddingInlineEnd: spacing[8],
  }),

  label: css({
    paddingInline: spacing["1.5"],
    paddingBlock: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
  }),
  labelInset: css({ paddingInlineStart: spacing[7] }),

  separator: css({
    marginInline: `calc(${spacing[1]} * -1)`,
    marginBlock: spacing[1],
    height: "1px",
    backgroundColor: menuCtx.separator,
  }),

  shortcut: css({
    marginInlineStart: "auto",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    letterSpacing: letterSpacing.widest,
    color: theme.mutedForeground,
  }),

  /** The trailing check on a checkbox or radio row. */
  indicator: css({
    pointerEvents: "none",
    position: "absolute",
    insetInlineEnd: spacing[2],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),

  /** The chevron on a submenu trigger. */
  submenuChevron: css({
    marginInlineStart: "auto",
  }),
}

export const menuItem = recipe({
  base: menuStyles.itemBase,
  variants: {
    variant: {
      default: menuStyles.itemDefault,
      destructive: menuStyles.itemDestructive,
    },
  },
  defaults: { variant: "default" },
})
