import { css, props as styleProps } from "@kirana-style/core"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import type { Sx } from "../lib/sx"
import { alpha, radius, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"

const styles = {
  root: css({ position: "relative" }),
  viewport: css({
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    outlineStyle: "none",
    transitionProperty: "color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
  }),
  scrollbar: css({
    display: "flex",
    touchAction: "none",
    padding: "1px",
    userSelect: "none",
    transitionProperty: "background-color, border-color",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    borderColor: "transparent",
    borderStyle: "solid",

    height: {
      '[data-orientation="horizontal"]': spacing["2.5"],
      '[data-orientation="vertical"]': "100%",
    },
    width: { '[data-orientation="vertical"]': spacing["2.5"] },
    flexDirection: {
      '[data-orientation="horizontal"]': "column",
    },
    borderTopWidth: {
      base: 0,
      '[data-orientation="horizontal"]': "1px",
    },
    borderInlineStartWidth: {
      base: 0,
      '[data-orientation="vertical"]': "1px",
    },
  }),
  thumb: css({
    position: "relative",
    flex: 1,
    borderRadius: radius.full,
    backgroundColor: theme.border,
  }),
}

function ScrollArea({
  sx,
  children,
  ...props
}: Omit<ScrollAreaPrimitive.Root.Props, "className"> & { sx?: Sx }) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      {...props}
      {...styleProps(styles.root, sx)}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        {...styleProps(styles.viewport)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  sx,
  orientation = "vertical",
  ...props
}: Omit<ScrollAreaPrimitive.Scrollbar.Props, "className"> & { sx?: Sx }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      {...props}
      {...styleProps(styles.scrollbar, sx)}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        {...styleProps(styles.thumb)}
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
