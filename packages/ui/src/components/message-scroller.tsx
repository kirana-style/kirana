import { css, props as styleProps } from "@kirana-style/core"
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import { scrollFadeStyles } from "../recipes/scroll-fade"
import { Button } from "./button"
import { Icon } from "../primitives/icon"
import { VisuallyHidden } from "../primitives/visually-hidden"
import { theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { spacing } from "../tokens/spacing"

const styles = {
  root: css({
    position: "relative",
    display: "flex",
    width: "100%",
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    overflow: "hidden",
  }),

  viewport: css({
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    contain: "content",
    scrollbarWidth: "thin",
    scrollbarGutter: "stable",
    // The scrollbar would flicker while the view is animating itself to the end.
    scrollbarColor: {
      "[data-autoscrolling]": "transparent transparent",
    },
    // Hidden until the first scroll position is resolved, so the list never
    // appears at the top and then jumps to the bottom.
    visibility: { "[data-pending-scroll]": "hidden" },
  }),

  content: css({
    display: "flex",
    height: "max-content",
    minHeight: "100%",
    flexDirection: "column",
    gap: spacing[6],
  }),

  item: css({
    minWidth: 0,
    flexShrink: 0,
    // Lets the browser skip laying out messages that are far off screen.
    contentVisibility: "auto",
    containIntrinsicSize: "auto 10rem",
  }),

  button: css({
    position: "absolute",
    left: "50%",
    borderColor: theme.border,
    backgroundColor: { base: theme.background, ":hover": theme.muted },
    color: { base: theme.foreground, ":hover": theme.foreground },
    transitionProperty: "translate, scale, opacity",

    // Slides away into the edge it points at, rather than just fading.
    translate: {
      base: "-50% 0",
      '[data-active="false"]': {
        base: "-50% 0",
        '[data-direction="end"]': "-50% 100%",
        '[data-direction="start"]': "-50% -100%",
      },
    },
    scale: { base: 1, '[data-active="false"]': 0.95 },
    opacity: { base: 1, '[data-active="false"]': 0 },
    pointerEvents: { '[data-active="false"]': "none" },
    // Leaving takes longer than arriving, on a sharper curve.
    transitionDuration: {
      base: duration[200],
      '[data-active="false"]': duration[450],
    },
    transitionTimingFunction: {
      base: easing.emphasized,
      '[data-active="false"]': "cubic-bezier(0.7, 0, 0.84, 0)",
    },

    bottom: { '[data-direction="end"]': spacing[4] },
    top: { '[data-direction="start"]': spacing[4] },
  }),
  /** The same chevron, pointed the other way. */
  iconUp: css({ rotate: "180deg" }),
}

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>
) {
  return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof MessageScrollerPrimitive.Root>,
  "className"
> & { sx?: Sx }) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      {...props}
      {...styleProps(styles.root, sx)}
    />
  )
}

function MessageScrollerViewport({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>,
  "className"
> & { sx?: Sx }) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      {...props}
      {...styleProps(styles.viewport, scrollFadeStyles.bottom, sx)}
    />
  )
}

function MessageScrollerContent({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof MessageScrollerPrimitive.Content>,
  "className"
> & { sx?: Sx }) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      {...props}
      {...styleProps(styles.content, sx)}
    />
  )
}

function MessageScrollerItem({
  sx,
  scrollAnchor = false,
  ...props
}: Omit<
  React.ComponentProps<typeof MessageScrollerPrimitive.Item>,
  "className"
> & { sx?: Sx }) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      {...props}
      {...styleProps(styles.item, sx)}
    />
  )
}

function MessageScrollerButton({
  direction = "end",
  sx,
  children,
  render,
  variant = "secondary",
  size = "icon-sm",
  ...props
}: Omit<
  React.ComponentProps<typeof MessageScrollerPrimitive.Button>,
  "className"
> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & { sx?: Sx }) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      render={
        render ?? (
          <Button
            variant={variant}
            size={size}
            sx={mergeSx(styles.button, sx)}
          />
        )
      }
      {...props}
    >
      {children ?? (
        <>
          <Icon
            icon={ArrowDown01Icon}
            sx={direction === "start" ? styles.iconUp : null}
          />
          <VisuallyHidden>
            {direction === "end" ? "Scroll to end" : "Scroll to start"}
          </VisuallyHidden>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
}
