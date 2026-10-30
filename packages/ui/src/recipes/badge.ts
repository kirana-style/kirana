/**
 * The Badge recipe. A condition key cannot match the element's own tag, so the
 * hover styles apply whatever the badge renders as; in practice only a badge
 * rendered as a link receives hover.
 */

import { css } from "@kirana-style/core"

import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const styles = {
  base: css({
    display: "inline-flex",
    height: spacing[5],
    width: "fit-content",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    overflow: "hidden",
    borderRadius: radius["4xl"],
    borderWidth: "1px",
    borderStyle: "solid",
    paddingInline: spacing[2],
    paddingInlineEnd: {
      base: spacing[2],
      ':has([data-icon="inline-end"])': spacing["1.5"],
    },
    paddingInlineStart: {
      base: spacing[2],
      ':has([data-icon="inline-start"])': spacing["1.5"],
    },
    paddingBlock: spacing["0.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    [ctx.iconSize]: "0.75rem",
  }),
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

  default: css({
    backgroundColor: { base: theme.primary, ":hover": alpha.primary80 },
    color: theme.primaryForeground,
  }),
  secondary: css({
    backgroundColor: { base: theme.secondary, ":hover": alpha.secondary80 },
    color: theme.secondaryForeground,
  }),
  destructive: css({
    backgroundColor: {
      base: surface.destructiveSoft,
      ":hover": surface.destructiveSoftHover,
    },
    color: theme.destructive,
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
  }),
  outline: css({
    borderColor: {
      base: theme.border,
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    color: { base: theme.foreground, ":hover": theme.mutedForeground },
    backgroundColor: { ":hover": theme.muted },
  }),
  ghost: css({
    backgroundColor: { ":hover": surface.hover },
    color: { ":hover": theme.mutedForeground },
  }),
  link: css({
    color: theme.primary,
    textUnderlineOffset: "4px",
    textDecorationLine: { base: "none", ":hover": "underline" },
  }),
}

export const badge = recipe({
  base: styles.base,
  variants: {
    variant: {
      default: styles.default,
      secondary: styles.secondary,
      destructive: styles.destructive,
      outline: styles.outline,
      ghost: styles.ghost,
      link: styles.link,
    },
  },
  defaults: { variant: "default" },
})

export const badgeRing = styles.ring
