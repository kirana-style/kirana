import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import type { Sx } from "../lib/sx"
import { drawerCtx } from "../theme/context"
import { drawerPopupMarker } from "../theme/markers"
import { radius, theme } from "../theme/semantic"
import { blur } from "../tokens/blur"
import { breakpoint } from "../tokens/breakpoints"
import { duration, easing } from "../tokens/motion"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

/** Live gesture values Base UI writes onto the popup. */
const SWIPE_X = "var(--drawer-swipe-movement-x)"
const SWIPE_Y = "var(--drawer-swipe-movement-y)"
const SNAP_OFFSET = "var(--drawer-snap-point-offset, 0px)"
const INSET = "var(--drawer-inset, 0px)"
/** A swipe that is released fast closes faster, proportionally. */
const FLICK = "calc(var(--drawer-swipe-strength) * 400ms)"

/**
 * The stack geometry, composed here rather than in `theme/context.ts`: every
 * formula reads a variable Base UI writes onto the popup, and a token default is
 * substituted on `:root`, where it would be invalid and take the whole
 * `transform` with it.
 */
/** How much each nested drawer shrinks the one behind it. */
const STACK_STEP = "0.05"
/** Swipe progress, clamped so an over-drag cannot invert the stack. */
const PROGRESS = "clamp(0, var(--drawer-swipe-progress), 1)"
const SCALE_BASE = `max(0, calc(1 - (var(--nested-drawers) * ${STACK_STEP})))`
const SCALE = `clamp(0, calc(${SCALE_BASE} + (${STACK_STEP} * ${PROGRESS})), 1)`

const styles = {
  overlay: css({
    // iOS Safari cannot hold a fixed backdrop still while the page rubber-bands,
    // so there it is positioned against the page instead of the viewport.
    position: {
      base: "fixed",
      "@supports (-webkit-touch-callout: none)": "absolute",
    },
    inset: 0,
    zIndex: zIndex.overlay,
    minHeight: "100dvh",
    backgroundColor: "rgb(0 0 0 / 0.1)",
    userSelect: "none",
    transitionProperty: "opacity",
    transitionTimingFunction: easing.decelerate,
    backdropFilter: {
      "@supports (backdrop-filter: blur(1px))": `blur(${blur.xs})`,
    },

    // Fades out in step with the drag, and never below the floor a snap-point
    // drawer sets so the content behind stays dimmed at rest.
    opacity: {
      base: `max(var(--drawer-overlay-min-opacity, 0), calc(1 - var(--drawer-swipe-progress)))`,
      "[data-starting-style]": 0,
      "[data-ending-style]": 0,
    },
    // No plain default: the `var()` above falls back to 0.
    "--drawer-overlay-min-opacity": {
      "[data-snap-points]": "0.5",
    },
    pointerEvents: { "[data-ending-style]": "none" },
    // The backdrop follows the finger while swiping, even as the popup leaves.
    transitionDuration: {
      base: duration[450],
      "[data-swiping]": duration[0],
      "[data-ending-style]": { base: FLICK, "[data-swiping]": duration[0] },
    },
  }),

  viewport: css({
    pointerEvents: { base: "none", '[data-modal="true"]': "auto" },
    position: "fixed",
    inset: 0,
    zIndex: zIndex.overlay,
    userSelect: "none",
  }),

  popup: css({
    pointerEvents: "auto",
    position: "fixed",
    zIndex: zIndex.popover,
    // Longhands: the inset is a custom property, which a shorthand cannot prove is one value.
    marginTop: INSET,
    marginRight: INSET,
    marginBottom: INSET,
    marginLeft: INSET,
    display: "flex",
    flexDirection: { base: "column", '[data-swipe-axis="x"]': "row" },
    minHeight: 0,
    backgroundColor: theme.popover,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.popoverForeground,
    willChange: "transform",
    outlineStyle: "none",
    userSelect: "none",
    // Lets `height: auto` participate in the height transition.
    interpolateSize: "allow-keywords",

    height: {
      base: drawerCtx.contentHeight,
      '[data-swipe-axis="y"][data-nested-drawer-open]': drawerCtx.stackHeight,
    },
    maxHeight: drawerCtx.contentMaxHeight,
    width: drawerCtx.contentWidth,

    /**
     * Size per axis. No `base` on purpose: the default stays the token's own
     * declaration on `:root`, merely inherited, so any element-level condition
     * beats it. Where a value has to apply unconditionally and be overridden,
     * both branches are attribute conditions and specificity decides: the
     * two-attribute compound below wins over the one-attribute rule.
     */
    [drawerCtx.contentWidth]: {
      '[data-swipe-axis="x"]': {
        base: "75%",
        [breakpoint.sm]: "24rem",
      },
    },
    [drawerCtx.contentMaxHeight]: {
      '[data-swipe-axis="y"]': "calc(100dvh - 6rem)",
    },
    [drawerCtx.contentHeight]: {
      '[data-swipe-axis="x"]': "var(--drawer-height, auto)",
      '[data-swipe-axis="y"]': "var(--drawer-height, auto)",
      '[data-swipe-axis="y"][data-snap-points]': "100dvh",
    },

    insetInline: { '[data-swipe-axis="y"]': 0 },
    insetBlock: { '[data-swipe-axis="x"]': 0 },
    bottom: { '[data-swipe-direction="down"]': 0 },
    top: { '[data-swipe-direction="up"]': 0 },
    insetInlineStart: { '[data-swipe-direction="left"]': 0 },
    insetInlineEnd: { '[data-swipe-direction="right"]': 0 },
    transformOrigin: {
      '[data-swipe-direction="down"]': "bottom",
      '[data-swipe-direction="up"]': "top",
      '[data-swipe-direction="left"]': "left",
      '[data-swipe-direction="right"]': "right",
    },

    // Only the edge the drawer slides from stays square.
    borderStartStartRadius: {
      base: 0,
      '[data-swipe-direction="down"]': radius.xl,
      '[data-swipe-direction="right"]': radius.xl,
    },
    borderStartEndRadius: {
      base: 0,
      '[data-swipe-direction="down"]': radius.xl,
      '[data-swipe-direction="left"]': radius.xl,
    },
    borderEndStartRadius: {
      base: 0,
      '[data-swipe-direction="up"]': radius.xl,
      '[data-swipe-direction="right"]': radius.xl,
    },
    borderEndEndRadius: {
      base: 0,
      '[data-swipe-direction="up"]': radius.xl,
      '[data-swipe-direction="left"]': radius.xl,
    },
    borderTopWidth: { base: 0, '[data-swipe-direction="down"]': "1px" },
    borderBottomWidth: { base: 0, '[data-swipe-direction="up"]': "1px" },
    borderInlineStartWidth: {
      base: 0,
      '[data-swipe-direction="right"]': "1px",
    },
    borderInlineEndWidth: {
      base: 0,
      '[data-swipe-direction="left"]': "1px",
    },
    borderColor: theme.border,
    borderStyle: "solid",

    // A drawer with another open on top of it recedes slightly.
    overflow: { "[data-nested-drawer-open]": "hidden" },
    filter: { "[data-nested-drawer-open]": "brightness(0.95)" },

    [drawerCtx.stackHeight]:
      "var(--drawer-frontmost-height, var(--drawer-height, 0px))",
    [drawerCtx.stackScale]: SCALE,
    [drawerCtx.stackShrink]: `calc(1 - ${SCALE})`,
    [drawerCtx.stackPeekOffset]: `max(0px, calc((var(--nested-drawers) - ${PROGRESS}) * ${drawerCtx.peek}))`,

    // Where the drawer sits when closed, per direction.
    [drawerCtx.closedTransform]: {
      '[data-swipe-direction="down"]': `translate3d(0, calc(100% + ${INSET} + 2px), 0)`,
      '[data-swipe-direction="up"]': `translate3d(0, calc(-100% - ${INSET} - 2px), 0)`,
      '[data-swipe-direction="left"]': `translate3d(calc(-100% - ${INSET} - 2px), 0, 0)`,
      '[data-swipe-direction="right"]': `translate3d(calc(100% + ${INSET} + 2px), 0, 0)`,
    },
    // Live position: the drag, plus the stack offsets for drawers behind it.
    [drawerCtx.translateY]: {
      '[data-swipe-direction="down"]': `calc(${SNAP_OFFSET} + ${SWIPE_Y} - ${drawerCtx.stackPeekOffset} - (${drawerCtx.stackShrink} * ${drawerCtx.stackHeight}))`,
      '[data-swipe-direction="up"]': `calc(${SNAP_OFFSET} + ${SWIPE_Y} + ${drawerCtx.stackPeekOffset} + (${drawerCtx.stackShrink} * ${drawerCtx.stackHeight}))`,
    },
    [drawerCtx.translateX]: {
      '[data-swipe-direction="left"]': `calc(${SWIPE_X} + ${drawerCtx.stackPeekOffset} + (${drawerCtx.stackShrink} * 100%))`,
      '[data-swipe-direction="right"]': `calc(${SWIPE_X} - ${drawerCtx.stackPeekOffset} - (${drawerCtx.stackShrink} * 100%))`,
    },

    transform: {
      base: `translate3d(${drawerCtx.translateX}, ${drawerCtx.translateY}, 0) scale(${drawerCtx.stackScale})`,
      "[data-starting-style]": drawerCtx.closedTransform,
      "[data-ending-style]": drawerCtx.closedTransform,
    },
    // Not quite 1: keeps the element composited through the exit transition.
    opacity: { "[data-ending-style]": 0.9999 },
    transitionProperty: "transform, height, opacity, filter",
    transitionTimingFunction: easing.emphasized,
    // Follows the finger while swiping; a release that dismisses animates at
    // the flick's speed.
    transitionDuration: {
      base: duration[450],
      "[data-swiping]": { base: duration[0], "[data-ending-style]": FLICK },
      "[data-nested-drawer-swiping]": {
        base: duration[0],
        "[data-ending-style]": FLICK,
      },
      "[data-ending-style]": FLICK,
    },

    // Solid bleed past the leading edge, so an elastic over-drag shows no seam.
    "::after": {
      content: "''",
      pointerEvents: "none",
      position: "absolute",
      backgroundColor: theme.popover,
    },
  }),
  /**
   * The bleed's own geometry, which depends on the swipe axis. It extends past
   * the edge the drawer is attached to — above a top drawer, left of a left one —
   * so it stays off-screen at rest and only fills the gap an over-drag opens.
   */
  popupBleedY: css({
    "::after": {
      insetInline: 0,
      height: drawerCtx.bleed,
      top: { '[data-swipe-direction="down"]': "100%" },
      bottom: { '[data-swipe-direction="up"]': "100%" },
    },
  }),
  popupBleedX: css({
    "::after": {
      insetBlock: 0,
      width: drawerCtx.bleed,
      insetInlineStart: {
        '[data-swipe-direction="right"]': "100%",
      },
      insetInlineEnd: {
        '[data-swipe-direction="left"]': "100%",
      },
    },
  }),

  content: css({
    display: "flex",
    minHeight: 0,
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
    overscrollBehavior: "contain",
    borderRadius: "inherit",
    userSelect: {
      base: "text",
      [drawerPopupMarker.within("[data-swiping]")]: "none",
    },
    transitionProperty: "opacity",
    transitionDuration: duration[300],
    transitionTimingFunction: easing.overshoot,
    // Hidden behind a nested drawer, shown again while that drawer is swiped away.
    opacity: {
      base: 1,
      [drawerPopupMarker.within("[data-nested-drawer-open]")]: {
        base: 0,
        [drawerPopupMarker.within("[data-nested-drawer-swiping]")]: 1,
      },
    },
  }),

  handle: css({
    position: "relative",
    zIndex: 10,
    display: "flex",
    flexShrink: 0,
    cursor: { base: "grab", ":active": "grabbing" },
    transitionProperty: "opacity",
    transitionDuration: duration[200],
    // Hidden behind a nested drawer, shown again while that drawer is swiped away.
    opacity: {
      base: 1,
      [drawerPopupMarker.within("[data-nested-drawer-open]")]: {
        base: 0,
        [drawerPopupMarker.within("[data-nested-drawer-swiping]")]: 1,
      },
    },

    height: {
      [drawerPopupMarker.within('[data-swipe-axis="x"]')]: "100%",
      [drawerPopupMarker.within('[data-swipe-axis="y"]')]: spacing[3],
    },
    width: {
      [drawerPopupMarker.within('[data-swipe-axis="x"]')]: spacing[3],
      [drawerPopupMarker.within('[data-swipe-axis="y"]')]: "100%",
    },
    alignItems: {
      [drawerPopupMarker.within('[data-swipe-axis="x"]')]: "center",
      [drawerPopupMarker.within('[data-swipe-direction="down"]')]: "flex-end",
      [drawerPopupMarker.within('[data-swipe-direction="up"]')]: "flex-start",
    },
    justifyContent: {
      [drawerPopupMarker.within('[data-swipe-axis="y"]')]: "center",
      [drawerPopupMarker.within('[data-swipe-direction="left"]')]: "flex-start",
      [drawerPopupMarker.within('[data-swipe-direction="right"]')]: "flex-end",
    },
    // Dragging up or left means the handle belongs on the far edge.
    order: {
      [drawerPopupMarker.within('[data-swipe-direction="left"]')]: 1,
      [drawerPopupMarker.within('[data-swipe-direction="up"]')]: 1,
    },

    "::after": {
      content: "''",
      display: "block",
      flexShrink: 0,
      borderRadius: radius.full,
      backgroundColor: theme.muted,
    },
  }),
  handleBarY: css({ "::after": { height: spacing[1], width: spacing[24] } }),
  handleBarX: css({ "::after": { height: spacing[24], width: spacing[1] } }),

  header: css({
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    gap: spacing["0.5"],
    padding: spacing[4],
    paddingBottom: 0,
    /**
     * A top or bottom drawer stays centred at every width; the `md` start
     * alignment only reaches side drawers. Nested, so the intent holds whatever
     * the precedence ladder ranks first.
     */
    textAlign: {
      [drawerPopupMarker.within('[data-swipe-axis="y"]')]: "center",
      [breakpoint.md]: {
        base: "start",
        [drawerPopupMarker.within('[data-swipe-axis="y"]')]: "center",
      },
    },
  }),
  footer: css({
    marginTop: "auto",
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    gap: spacing[2],
    padding: spacing[4],
    paddingTop: 0,
  }),
  title: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textWrap: "balance",
    color: theme.mutedForeground,
  }),
}

type DrawerContextValue = {
  hasSnapPoints: boolean
  modal: DrawerPrimitive.Root.Props["modal"]
  showSwipeHandle: boolean
  swipeDirection: NonNullable<DrawerPrimitive.Root.Props["swipeDirection"]>
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

function useDrawer() {
  const context = React.useContext(DrawerContext)

  if (!context) {
    throw new Error("useDrawer must be used within a Drawer.")
  }

  return context
}

function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  swipeDirection = "down",
  ...props
}: DrawerPrimitive.Root.Props & { showSwipeHandle?: boolean }) {
  const hasSnapPoints = snapPoints != null && snapPoints.length > 0
  const contextValue = React.useMemo(
    () => ({ hasSnapPoints, modal, showSwipeHandle, swipeDirection }),
    [hasSnapPoints, modal, showSwipeHandle, swipeDirection]
  )

  return (
    <DrawerContext value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        snapPoints={snapPoints}
        swipeDirection={swipeDirection}
        {...props}
      />
    </DrawerContext>
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  sx,
  ...props
}: Omit<DrawerPrimitive.Backdrop.Props, "className"> & { sx?: Sx }) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      {...props}
      {...styleProps(styles.overlay, sx)}
    />
  )
}

function DrawerSwipeHandle({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  const { swipeDirection } = useDrawer()
  const axis = swipeDirection === "down" || swipeDirection === "up" ? "y" : "x"

  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      {...props}
      sx={[
        styles.handle,
        axis === "y" ? styles.handleBarY : styles.handleBarX,
        sx,
      ]}
    />
  )
}

function DrawerContent({
  sx,
  children,
  ...props
}: Omit<DrawerPrimitive.Popup.Props, "className"> & { sx?: Sx }) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeDirection } = useDrawer()
  const swipeAxis =
    swipeDirection === "down" || swipeDirection === "up" ? "y" : "x"

  return (
    <DrawerPortal data-slot="drawer-portal">
      {modal === true && (
        <DrawerOverlay data-snap-points={hasSnapPoints ? "" : undefined} />
      )}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={modal}
        {...styleProps(styles.viewport)}
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis={swipeAxis}
          data-snap-points={hasSnapPoints ? "" : undefined}
          {...props}
          {...styleProps(
            drawerPopupMarker.anchor,
            styles.popup,
            swipeAxis === "y" ? styles.popupBleedY : styles.popupBleedX,
            sx
          )}
        >
          {showSwipeHandle && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            {...styleProps(styles.content)}
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function DrawerHeader({ sx, ...props }: El) {
  return <div data-slot="drawer-header" {...props} sx={[styles.header, sx]} />
}

function DrawerFooter({ sx, ...props }: El) {
  return <div data-slot="drawer-footer" {...props} sx={[styles.footer, sx]} />
}

function DrawerTitle({
  sx,
  ...props
}: Omit<DrawerPrimitive.Title.Props, "className"> & { sx?: Sx }) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      {...props}
      {...styleProps(styles.title, sx)}
    />
  )
}

function DrawerDescription({
  sx,
  ...props
}: Omit<DrawerPrimitive.Description.Props, "className"> & { sx?: Sx }) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      {...props}
      {...styleProps(styles.description, sx)}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
