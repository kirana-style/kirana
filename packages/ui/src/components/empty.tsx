import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { radius, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import {
  fontSize,
  fontWeight,
  leading,
  letterSpacing,
  lineHeight,
} from "../tokens/typography"

const styles = {
  root: css({
    display: "flex",
    width: "100%",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
    borderRadius: radius.xl,
    // Dashed but zero width, so a caller's `borderWidth` is all it takes to
    // draw the outline.
    borderWidth: 0,
    borderStyle: "dashed",
    borderColor: theme.border,
    padding: spacing[6],
    textAlign: "center",
    textWrap: "balance",
  }),
  header: css({
    display: "flex",
    maxWidth: "24rem",
    flexDirection: "column",
    alignItems: "center",
    gap: spacing[2],
  }),

  mediaBase: css({
    marginBottom: spacing[2],
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  }),
  mediaDefault: css({ backgroundColor: "transparent" }),
  mediaIcon: css({
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.lg,
    backgroundColor: theme.muted,
    color: theme.foreground,
    [ctx.iconSize]: "1rem",
  }),

  title: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: leading.relaxed,
    color: theme.mutedForeground,
    // Links written straight into the description; see globals.css.
    "--inline-link-hover": theme.primary,
  }),
  content: css({
    display: "flex",
    width: "100%",
    maxWidth: "24rem",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "center",
    gap: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textWrap: "balance",
  }),
}

const emptyMedia = recipe({
  base: styles.mediaBase,
  variants: {
    variant: { default: styles.mediaDefault, icon: styles.mediaIcon },
  },
  defaults: { variant: "default" },
})

type El<T extends keyof React.JSX.IntrinsicElements = "div"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function Empty({ sx, ...props }: El) {
  return <div data-slot="empty" {...props} sx={[styles.root, sx]} />
}

function EmptyHeader({ sx, ...props }: El) {
  return <div data-slot="empty-header" {...props} sx={[styles.header, sx]} />
}

function EmptyMedia({
  sx,
  variant,
  ...props
}: El & VariantProps<typeof emptyMedia>) {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      {...props}
      sx={[...emptyMedia({ variant }), sx]}
    />
  )
}

function EmptyTitle({ sx, ...props }: El) {
  return <div data-slot="empty-title" {...props} sx={[styles.title, sx]} />
}

function EmptyDescription({ sx, ...props }: El<"p">) {
  return (
    <p data-slot="empty-description" {...props} sx={[styles.description, sx]} />
  )
}

function EmptyContent({ sx, ...props }: El) {
  return <div data-slot="empty-content" {...props} sx={[styles.content, sx]} />
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  emptyMedia as emptyMediaVariants,
}
