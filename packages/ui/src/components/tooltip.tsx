import { css, props as styleProps } from "@kirana-style/core"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import type { Sx } from "../lib/sx"
import { overlayStyles } from "../recipes/overlay"
import { ctx } from "../theme/context"
import { tooltipContentMarker } from "../theme/markers"
import { radius, theme } from "../theme/semantic"
import { duration } from "../tokens/motion"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

const styles = {
  positioner: css({ isolation: "isolate", zIndex: zIndex.popover }),
  content: css({
    // `tw-animate-css`'s 150ms default rather than the overlays' 100ms.
    transitionDuration: duration[150],
    zIndex: zIndex.popover,
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "20rem",
    alignItems: "center",
    gap: spacing["1.5"],
    borderRadius: radius.md,
    // Inverted against the page, which is why Kbd flips its colours in here.
    backgroundColor: theme.foreground,
    color: theme.background,
    paddingInline: spacing[3],
    paddingInlineEnd: {
      base: spacing[3],
      ':has([data-slot="kbd"])': spacing["1.5"],
    },
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    [ctx.iconSize]: "0.875rem",
  }),
  arrow: css({
    zIndex: zIndex.popover,
    width: spacing["2.5"],
    height: spacing["2.5"],
    rotate: "45deg",
    borderRadius: "2px",
    backgroundColor: theme.foreground,
    fill: theme.foreground,

    top: {
      '[data-side="bottom"]': spacing[1],
      '[data-side="left"]': "50%",
      '[data-side="right"]': "50%",
      '[data-side="inline-start"]': "50%",
      '[data-side="inline-end"]': "50%",
    },
    bottom: {
      '[data-side="top"]': `calc(${spacing["2.5"]} * -1)`,
    },
    insetInlineStart: {
      '[data-side="inline-end"]': `calc(${spacing[1]} * -1)`,
    },
    insetInlineEnd: {
      '[data-side="inline-start"]': `calc(${spacing[1]} * -1)`,
    },
    left: { '[data-side="right"]': `calc(${spacing[1]} * -1)` },
    right: { '[data-side="left"]': `calc(${spacing[1]} * -1)` },
    translate: {
      base: "0 calc(-50% - 2px)",
      '[data-side="left"]': "0 -50%",
      '[data-side="right"]': "0 -50%",
      '[data-side="inline-start"]': "0 -50%",
      '[data-side="inline-end"]': "0 -50%",
    },
  }),
}

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  sx,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: Omit<TooltipPrimitive.Popup.Props, "className"> &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { sx?: Sx }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        {...styleProps(styles.positioner)}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          {...props}
          {...styleProps(
            tooltipContentMarker.anchor,
            overlayStyles.popup,
            styles.content,
            sx
          )}
        >
          {children}
          <TooltipPrimitive.Arrow {...styleProps(styles.arrow)} />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
