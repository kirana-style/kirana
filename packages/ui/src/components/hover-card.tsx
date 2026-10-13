import { css, props as styleProps } from "@kirana-style/core"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

import type { Sx } from "../lib/sx"
import { menuStyles } from "../recipes/menu"
import { overlayStyles } from "../recipes/overlay"
import { alpha, radius, theme } from "../theme/semantic"
import { shadow } from "../tokens/shadows"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

const styles = {
  content: css({
    zIndex: zIndex.popover,
    width: spacing[64],
    borderRadius: radius.lg,
    backgroundColor: theme.popover,
    padding: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.popoverForeground,
    boxShadow: `0 0 0 1px ${alpha.foreground10}, ${shadow.md}`,
    outlineStyle: "none",
  }),
}

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />
}

function HoverCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  )
}

function HoverCardContent({
  sx,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  ...props
}: Omit<PreviewCardPrimitive.Popup.Props, "className"> &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { sx?: Sx }) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        {...styleProps(menuStyles.positioner)}
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          {...props}
          {...styleProps(overlayStyles.popup, styles.content, sx)}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
