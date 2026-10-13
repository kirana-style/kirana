import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { bubbleMarker, messageMarker } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, leading, lineHeight } from "../tokens/typography"

/**
 * A chat bubble.
 *
 * Every variant in the original styled the *child* from the parent —
 * `*:data-[slot=bubble-content]:bg-primary` and a matching
 * `[&>[data-slot=bubble-content]:is(button,a):hover]` rule for each. The variant
 * moved onto `BubbleContent`, which reads it through React context instead of
 * being styled from its parent. `Bubble` still takes the prop, so the API is unchanged.
 *
 * Dropping the `:is(button,a)` qualifier means hover applies whenever the bubble
 * is interactive, which is the only case it could apply before.
 */

const styles = {
  group: css({
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing[2],
  }),

  root: css({
    position: "relative",
    display: "flex",
    width: "fit-content",
    maxWidth: "80%",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing[1],
    alignSelf: {
      '[data-align="end"]': "flex-end",
      [messageMarker.within('[data-align="end"]')]: "flex-end",
    },
  }),
  rootGhost: css({ maxWidth: "100%", borderStyle: "none" }),

  contentBase: css({
    width: "fit-content",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    borderRadius: radius["3xl"],
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    paddingInline: spacing[3],
    paddingBlock: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: leading.relaxed,
    overflowWrap: "break-word",
    textAlign: "left",
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    alignSelf: {
      [bubbleMarker.within('[data-align="end"]')]: "flex-end",
    },
  }),
  contentRing: css({
    borderColor: { base: "transparent", ":focus-visible": theme.ring },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.primary30}`,
    },
  }),

  default: css({
    backgroundColor: { base: theme.primary, ":hover": alpha.primary80 },
    color: theme.primaryForeground,
  }),
  secondary: css({
    backgroundColor: {
      base: theme.secondary,
      ":hover": `color-mix(in oklch, ${theme.secondary}, ${theme.foreground} 5%)`,
    },
    color: theme.secondaryForeground,
  }),
  muted: css({
    backgroundColor: {
      base: theme.muted,
      ":hover": `color-mix(in oklch, ${theme.muted}, ${theme.foreground} 5%)`,
    },
  }),
  tinted: css({
    backgroundColor: {
      base: surface.bubbleTinted,
      ":hover": surface.bubbleTintedHover,
    },
    color: theme.foreground,
  }),
  outline: css({
    borderColor: { base: theme.border, ":focus-visible": theme.ring },
    backgroundColor: {
      base: surface.outlineBackground,
      ":hover": surface.outlineHover,
    },
    color: { ":hover": theme.foreground },
  }),
  ghost: css({
    borderRadius: 0,
    backgroundColor: { base: "transparent", ":hover": surface.hover },
    // The base pads with `paddingInline`/`paddingBlock`, which a `padding`
    // shorthand here would never override.
    paddingInline: 0,
    paddingBlock: 0,
    color: { ":hover": theme.foreground },
  }),
  destructive: css({
    backgroundColor: {
      base: surface.destructiveSoft,
      ":hover": surface.destructiveSoftHover,
    },
    color: theme.destructive,
  }),

  reactionsBase: css({
    position: "absolute",
    zIndex: 10,
    display: "flex",
    width: "fit-content",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    borderRadius: "calc(infinity * 1px)",
    backgroundColor: theme.muted,
    paddingInline: spacing["1.5"],
    paddingBlock: spacing["0.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    // Cut out of the card behind it, so it reads as floating over the bubble.
    boxShadow: `0 0 0 3px ${theme.card}`,
    padding: { ":has(button)": 0 },
  }),
  sideTop: css({ top: 0, translate: "0 -75%" }),
  sideBottom: css({ bottom: 0, translate: "0 75%" }),
  alignStart: css({ insetInlineStart: spacing[3] }),
  alignEnd: css({ insetInlineEnd: spacing[3] }),
}

const bubbleContent = recipe({
  base: styles.contentBase,
  variants: {
    variant: {
      default: styles.default,
      secondary: styles.secondary,
      muted: styles.muted,
      tinted: styles.tinted,
      outline: styles.outline,
      ghost: styles.ghost,
      destructive: styles.destructive,
    },
  },
  defaults: { variant: "default" },
})

const bubbleReactions = recipe({
  base: styles.reactionsBase,
  variants: {
    side: { top: styles.sideTop, bottom: styles.sideBottom },
    align: { start: styles.alignStart, end: styles.alignEnd },
  },
  defaults: { side: "bottom", align: "end" },
})

type BubbleVariant = NonNullable<VariantProps<typeof bubbleContent>["variant"]>

/** Carries the bubble's variant down to its content. */
const BubbleContext = React.createContext<BubbleVariant>("default")

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function BubbleGroup({ sx, ...props }: El) {
  return <div data-slot="bubble-group" {...props} sx={[styles.group, sx]} />
}

function Bubble({
  variant = "default",
  align = "start",
  sx,
  children,
  ...props
}: El & { variant?: BubbleVariant; align?: "start" | "end" }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      {...props}
      sx={[
        bubbleMarker.anchor,
        styles.root,
        variant === "ghost" && styles.rootGhost,
        sx,
      ]}
    >
      <BubbleContext value={variant}>{children}</BubbleContext>
    </div>
  )
}

function BubbleContent({
  sx,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  const variant = React.useContext(BubbleContext)

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      styleProps(styles.contentRing, ...bubbleContent({ variant }), sx),
      props
    ),
    render,
    state: { slot: "bubble-content" },
  })
}

function BubbleReactions({
  side = "bottom",
  align = "end",
  sx,
  ...props
}: El & VariantProps<typeof bubbleReactions>) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      {...props}
      sx={[...bubbleReactions({ side, align }), sx]}
    />
  )
}

export {
  BubbleGroup,
  Bubble,
  BubbleContent,
  BubbleReactions,
  bubbleContent as bubbleVariants,
}
