import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, leading, lineHeight } from "../tokens/typography"

/**
 * A file attachment chip: a thumbnail or icon, a name, some metadata and an
 * optional action.
 */

const styles = {
  group: css({ display: "flex", flexWrap: "wrap", gap: spacing[2] }),

  base: css({
    position: "relative",
    display: "flex",
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: surface.control,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    [ctx.iconSize]: "1rem",
    transitionProperty: "opacity, border-color",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
  }),
  horizontal: css({
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["2.5"],
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[2],
  }),
  /** Stacked: the thumbnail sits above the name, as a small card. */
  vertical: css({
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing[2],
    width: spacing[32],
    overflow: "hidden",
    padding: 0,
    paddingBottom: spacing[2],
  }),

  /** While a file is uploading the chip reads as provisional. */
  uploading: css({ opacity: 0.7 }),
  error: css({ borderColor: surface.borderInvalid, color: theme.destructive }),

  mediaBase: css({
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    color: theme.mutedForeground,
  }),
  mediaDefault: css({
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.md,
    backgroundColor: theme.muted,
  }),
  /** A real thumbnail, cropped to fill whatever space the chip gives it. */
  mediaImage: css({
    width: "100%",
    aspectRatio: "4 / 3",
    overflow: "hidden",
    backgroundColor: theme.muted,
  }),
  image: css({ width: "100%", height: "100%", objectFit: "cover" }),

  content: css({
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: spacing["0.5"],
    paddingInline: { base: 0, ":first-child": spacing["2.5"] },
  }),
  title: css({
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: leading.snug,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  description: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),

  actions: css({
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: spacing[1],
  }),
  action: css({
    display: "inline-flex",
    width: spacing[6],
    height: spacing[6],
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    color: theme.mutedForeground,
    outlineStyle: "none",
    [ctx.iconSize]: "0.875rem",
    backgroundColor: { ":hover": surface.hover },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
  }),
  actionColor: css({
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),
}

const attachment = recipe({
  base: styles.base,
  variants: {
    orientation: { horizontal: styles.horizontal, vertical: styles.vertical },
    state: {
      idle: styles.base,
      uploading: styles.uploading,
      error: styles.error,
    },
  },
  defaults: { orientation: "horizontal", state: "idle" },
})

const attachmentMedia = recipe({
  base: styles.mediaBase,
  variants: {
    variant: { default: styles.mediaDefault, image: styles.mediaImage },
  },
  defaults: { variant: "default" },
})

type El<T extends keyof React.JSX.IntrinsicElements = "div"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function AttachmentGroup({ sx, ...props }: El) {
  return (
    <div
      role="list"
      data-slot="attachment-group"
      {...props}
      sx={[styles.group, sx]}
    />
  )
}

function Attachment({
  sx,
  orientation,
  state,
  ...props
}: El & VariantProps<typeof attachment>) {
  return (
    <div
      data-slot="attachment"
      data-orientation={orientation ?? "horizontal"}
      data-state={state ?? "idle"}
      {...props}
      sx={[...attachment({ orientation, state }), sx]}
    />
  )
}

function AttachmentMedia({
  sx,
  variant,
  ...props
}: El & VariantProps<typeof attachmentMedia>) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant ?? "default"}
      {...props}
      sx={[...attachmentMedia({ variant }), sx]}
    />
  )
}

/** The thumbnail inside an `AttachmentMedia variant="image"`. */
function AttachmentImage({ sx, ...props }: El<"img">) {
  return <img data-slot="attachment-image" {...props} sx={[styles.image, sx]} />
}

function AttachmentContent({ sx, ...props }: El) {
  return (
    <div data-slot="attachment-content" {...props} sx={[styles.content, sx]} />
  )
}

function AttachmentTitle({ sx, ...props }: El) {
  return <div data-slot="attachment-title" {...props} sx={[styles.title, sx]} />
}

function AttachmentDescription({ sx, ...props }: El<"p">) {
  return (
    <p
      data-slot="attachment-description"
      {...props}
      sx={[styles.description, sx]}
    />
  )
}

function AttachmentActions({ sx, ...props }: El) {
  return (
    <div data-slot="attachment-actions" {...props} sx={[styles.actions, sx]} />
  )
}

function AttachmentAction({ sx, type = "button", ...props }: El<"button">) {
  return (
    <button
      type={type}
      data-slot="attachment-action"
      {...props}
      sx={[styles.action, styles.actionColor, sx]}
    />
  )
}

export {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentImage,
  AttachmentMedia,
  AttachmentTitle,
  attachment as attachmentVariants,
}
