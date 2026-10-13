import { css, props as styleProps } from "@kirana-style/core"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { Separator } from "./separator"
import { ctx } from "../theme/context"
import { dropdownMenuContentMarker, itemMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, leading, lineHeight } from "../tokens/typography"

/** An item carrying a description aligns its media to the top instead of centre. */
/** Inside a dropdown the menu already supplies the padding. */
/** The group tightens its own spacing when it holds compact items. */

const styles = {
  group: css({
    display: "flex",
    width: "100%",
    flexDirection: "column",
    // The tightest item in the group sets its spacing.
    gap: {
      base: spacing[4],
      ':has([data-size="sm"])': {
        base: spacing["2.5"],
        ':has([data-size="xs"])': spacing[2],
      },
      ':has([data-size="xs"])': spacing[2],
    },
  }),
  separator: css({ marginBlock: spacing[2] }),

  base: css({
    display: "flex",
    width: "100%",
    flexWrap: "wrap",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[100],
    transitionTimingFunction: easing.inOut,
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
  }),
  /** Was `[a]:hover:bg-muted` — applied when the item is interactive. */
  interactive: css({ backgroundColor: { ":hover": theme.muted } }),

  default: css({
    borderColor: { base: "transparent", ":focus-visible": theme.ring },
  }),
  outline: css({
    borderColor: { base: theme.border, ":focus-visible": theme.ring },
  }),
  muted: css({
    borderColor: { base: "transparent", ":focus-visible": theme.ring },
    backgroundColor: alpha.muted50,
  }),

  defaultSize: css({
    gap: spacing["2.5"],
    paddingInline: spacing[3],
    paddingBlock: spacing["2.5"],
  }),
  sm: css({
    gap: spacing["2.5"],
    paddingInline: spacing[3],
    paddingBlock: spacing["2.5"],
  }),
  xs: css({
    gap: spacing[2],
    paddingInline: {
      base: spacing["2.5"],
      [dropdownMenuContentMarker.within("[data-slot]")]: 0,
    },
    paddingBlock: {
      base: spacing[2],
      [dropdownMenuContentMarker.within("[data-slot]")]: 0,
    },
  }),

  mediaBase: css({
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    translate: {
      [itemMarker.within(':has([data-slot="item-description"])')]:
        `0 ${spacing["0.5"]}`,
    },
    alignSelf: {
      [itemMarker.within(':has([data-slot="item-description"])')]: "flex-start",
    },
  }),
  mediaDefault: css({ backgroundColor: "transparent" }),
  mediaIcon: css({ [ctx.iconSize]: "1rem" }),
  mediaImage: css({
    overflow: "hidden",
    borderRadius: radius.sm,
    width: {
      base: spacing[10],
      [itemMarker.within('[data-size="sm"]')]: spacing[8],
      [itemMarker.within('[data-size="xs"]')]: spacing[6],
    },
    height: {
      base: spacing[10],
      [itemMarker.within('[data-size="sm"]')]: spacing[8],
      [itemMarker.within('[data-size="xs"]')]: spacing[6],
    },
  }),
  /** Was `[&_img]:size-full [&_img]:object-cover`, now its own element. */
  image: css({ width: "100%", height: "100%", objectFit: "cover" }),

  content: css({
    display: "flex",
    // `[&+[data-slot=item-content]]:flex-none`: a second content block right
    // after another keeps its own width, so the first takes the space.
    flex: { base: 1, ':is([data-slot="item-content"] + *)': "none" },
    flexDirection: "column",
    gap: {
      base: spacing[1],
      [itemMarker.within('[data-size="xs"]')]: 0,
    },
  }),
  /** A second content column sits beside the first rather than sharing its growth. */
  contentTrailing: css({ flex: "none" }),

  title: css({
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: leading.snug,
    fontWeight: fontWeight.medium,
    textUnderlineOffset: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  description: css({
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textAlign: "start",
    fontSize: {
      base: fontSize.sm,
      [itemMarker.within('[data-size="xs"]')]: fontSize.xs,
    },
    lineHeight: leading.normal,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
    // Links written straight into the description; see globals.css.
    "--inline-link-hover": theme.primary,
  }),
  actions: css({ display: "flex", alignItems: "center", gap: spacing[2] }),
  band: css({
    display: "flex",
    flexBasis: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
  }),
}

const item = recipe({
  base: styles.base,
  variants: {
    variant: {
      default: styles.default,
      outline: styles.outline,
      muted: styles.muted,
    },
    size: { default: styles.defaultSize, sm: styles.sm, xs: styles.xs },
  },
  defaults: { variant: "default", size: "default" },
})

const itemMedia = recipe({
  base: styles.mediaBase,
  variants: {
    variant: {
      default: styles.mediaDefault,
      icon: styles.mediaIcon,
      image: styles.mediaImage,
    },
  },
  defaults: { variant: "default" },
})

type El<T extends keyof React.JSX.IntrinsicElements = "div"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function ItemGroup({ sx, ...props }: El) {
  return (
    <div
      role="list"
      data-slot="item-group"
      {...props}
      sx={[styles.group, sx]}
    />
  )
}

function ItemSeparator({
  sx,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      {...props}
      sx={mergeSx(styles.separator, sx)}
    />
  )
}

function Item({
  sx,
  variant,
  size,
  interactive,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className"> &
  VariantProps<typeof item> & {
    /** Adds the hover affordance the original gave only to anchors. */
    interactive?: boolean
    sx?: Sx
  }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      styleProps(
        itemMarker.anchor,
        ...item({ variant, size }),
        interactive && styles.interactive,
        sx
      ),
      props
    ),
    render,
    state: { slot: "item", variant, size },
  })
}

function ItemMedia({
  sx,
  variant,
  ...props
}: El & VariantProps<typeof itemMedia>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      {...props}
      sx={[...itemMedia({ variant }), sx]}
    />
  )
}

/** The image inside an `ItemMedia variant="image"`. */
function ItemImage({ sx, ...props }: El<"img">) {
  return <img data-slot="item-image" {...props} sx={[styles.image, sx]} />
}

function ItemContent({
  sx,
  trailing,
  ...props
}: El & {
  /** A second content column, sized to its contents instead of growing. */
  trailing?: boolean
}) {
  return (
    <div
      data-slot="item-content"
      {...props}
      sx={[styles.content, trailing && styles.contentTrailing, sx]}
    />
  )
}

function ItemTitle({ sx, ...props }: El) {
  return <div data-slot="item-title" {...props} sx={[styles.title, sx]} />
}

function ItemDescription({ sx, ...props }: El<"p">) {
  return (
    <p data-slot="item-description" {...props} sx={[styles.description, sx]} />
  )
}

function ItemActions({ sx, ...props }: El) {
  return <div data-slot="item-actions" {...props} sx={[styles.actions, sx]} />
}

function ItemHeader({ sx, ...props }: El) {
  return <div data-slot="item-header" {...props} sx={[styles.band, sx]} />
}

function ItemFooter({ sx, ...props }: El) {
  return <div data-slot="item-footer" {...props} sx={[styles.band, sx]} />
}

export {
  Item,
  ItemMedia,
  ItemImage,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
}
