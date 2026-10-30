import { css, props as styleProps } from "@kirana-style/core"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import type { Sx } from "../lib/sx"
import { ctx } from "../theme/context"
import { avatarGroupMarker, avatarMarker } from "../theme/markers"
import { radius, surface, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"

const GROUP_HAS_SM = ':has([data-slot="avatar"][data-size="sm"])'
const GROUP_HAS_LG = ':has([data-slot="avatar"][data-size="lg"])'

const styles = {
  root: css({
    position: "relative",
    display: "flex",
    flexShrink: 0,
    borderRadius: radius.full,
    userSelect: "none",
    width: {
      base: spacing[8],
      '[data-size="sm"]': spacing[6],
      '[data-size="lg"]': spacing[10],
    },
    height: {
      base: spacing[8],
      '[data-size="sm"]': spacing[6],
      '[data-size="lg"]': spacing[10],
    },
    // A hairline over the image, blended so it reads on any artwork.
    "::after": {
      content: "''",
      position: "absolute",
      inset: 0,
      borderRadius: radius.full,
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: theme.border,
      mixBlendMode: surface.imageRingBlend,
    },
    // Inside a group an avatar overlaps its neighbour and gains a ring cut out
    // of the background.
    boxShadow: {
      [avatarGroupMarker.within('[data-slot="avatar-group"]')]:
        `0 0 0 2px ${theme.background}`,
    },
    // Each child is pulled over the next, so the last child, which may be the
    // count, keeps its full width.
    marginInlineEnd: {
      [avatarGroupMarker.within('[data-slot="avatar-group"]')]: {
        base: `calc(${spacing[2]} * -1)`,
        ":last-child": 0,
      },
    },
  }),

  image: css({
    aspectRatio: "1 / 1",
    width: "100%",
    height: "100%",
    borderRadius: radius.full,
    objectFit: "cover",
  }),

  fallback: css({
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: theme.muted,
    color: theme.mutedForeground,
    fontSize: {
      base: fontSize.sm,
      [avatarMarker.within('[data-size="sm"]')]: fontSize.xs,
    },
    lineHeight: {
      base: lineHeight.sm,
      [avatarMarker.within('[data-size="sm"]')]: lineHeight.xs,
    },
  }),

  badge: css({
    position: "absolute",
    insetInlineEnd: 0,
    bottom: 0,
    zIndex: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: theme.primary,
    color: theme.primaryForeground,
    boxShadow: `0 0 0 2px ${theme.background}`,
    userSelect: "none",
    width: {
      base: spacing["2.5"],
      [avatarMarker.within('[data-size="sm"]')]: spacing[2],
      [avatarMarker.within('[data-size="lg"]')]: spacing[3],
    },
    height: {
      base: spacing["2.5"],
      [avatarMarker.within('[data-size="sm"]')]: spacing[2],
      [avatarMarker.within('[data-size="lg"]')]: spacing[3],
    },
    // At the smallest size the badge is a dot with no room for a glyph, so the
    // icon size is zero.
    [ctx.iconSize]: {
      base: spacing[2],
      [avatarMarker.within('[data-size="sm"]')]: "0px",
    },
  }),

  group: css({
    display: "flex",
  }),

  // Sized to match the avatars in its group. A group mixing small and large
  // avatars sizes it small.
  groupCount: css({
    position: "relative",
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: theme.muted,
    color: theme.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    boxShadow: `0 0 0 2px ${theme.background}`,
    width: {
      base: spacing[8],
      [avatarGroupMarker.within(GROUP_HAS_SM)]: spacing[6],
      [avatarGroupMarker.within(GROUP_HAS_LG)]: {
        base: spacing[10],
        [avatarGroupMarker.within(GROUP_HAS_SM)]: spacing[6],
      },
    },
    height: {
      base: spacing[8],
      [avatarGroupMarker.within(GROUP_HAS_SM)]: spacing[6],
      [avatarGroupMarker.within(GROUP_HAS_LG)]: {
        base: spacing[10],
        [avatarGroupMarker.within(GROUP_HAS_SM)]: spacing[6],
      },
    },
    [ctx.iconSize]: {
      base: "1rem",
      [avatarGroupMarker.within(GROUP_HAS_SM)]: "0.75rem",
      [avatarGroupMarker.within(GROUP_HAS_LG)]: {
        base: "1.25rem",
        [avatarGroupMarker.within(GROUP_HAS_SM)]: "0.75rem",
      },
    },
  }),
}

function Avatar({
  sx,
  size = "default",
  ...props
}: Omit<AvatarPrimitive.Root.Props, "className"> & {
  size?: "default" | "sm" | "lg"
  sx?: Sx
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      {...props}
      {...styleProps(avatarMarker.anchor, styles.root, sx)}
    />
  )
}

function AvatarImage({
  sx,
  ...props
}: Omit<AvatarPrimitive.Image.Props, "className"> & { sx?: Sx }) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      {...props}
      {...styleProps(styles.image, sx)}
    />
  )
}

function AvatarFallback({
  sx,
  ...props
}: Omit<AvatarPrimitive.Fallback.Props, "className"> & { sx?: Sx }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      {...props}
      {...styleProps(styles.fallback, sx)}
    />
  )
}

function AvatarBadge({
  sx,
  ...props
}: Omit<React.ComponentProps<"span">, "className"> & { sx?: Sx }) {
  return <span data-slot="avatar-badge" {...props} sx={[styles.badge, sx]} />
}

function AvatarGroup({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return (
    <div
      data-slot="avatar-group"
      {...props}
      sx={[avatarGroupMarker.anchor, styles.group, sx]}
    />
  )
}

function AvatarGroupCount({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return (
    <div
      data-slot="avatar-group-count"
      {...props}
      sx={[styles.groupCount, sx]}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
