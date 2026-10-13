import { css, props as styleProps } from "@kirana-style/core"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import type { Sx } from "../lib/sx"
import { menuStyles } from "../recipes/menu"
import { overlayStyles } from "../recipes/overlay"
import { popoverContentMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { shadow } from "../tokens/shadows"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

const styles = {
  content: css({
    zIndex: zIndex.popover,
    display: "flex",
    width: spacing[72],
    flexDirection: "column",
    gap: spacing["2.5"],
    borderRadius: radius.lg,
    backgroundColor: theme.popover,
    padding: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.popoverForeground,
    // The ring first: the first shadow paints on top, and Tailwind emits
    // `ring-*` ahead of `shadow-*`.
    boxShadow: `0 0 0 1px ${alpha.foreground10}, ${shadow.md}`,
    outlineStyle: "none",
  }),
  header: css({
    display: "flex",
    flexDirection: "column",
    gap: spacing["0.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  title: css({ fontWeight: fontWeight.medium }),
  description: css({ color: theme.mutedForeground }),
}

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  sx,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "className"> &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { sx?: Sx }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        {...styleProps(menuStyles.positioner)}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          {...props}
          {...styleProps(
            popoverContentMarker.anchor,
            overlayStyles.popup,
            styles.content,
            sx
          )}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function PopoverHeader({ sx, ...props }: El) {
  return <div data-slot="popover-header" {...props} sx={[styles.header, sx]} />
}

function PopoverTitle({
  sx,
  ...props
}: Omit<PopoverPrimitive.Title.Props, "className"> & { sx?: Sx }) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      {...props}
      {...styleProps(styles.title, sx)}
    />
  )
}

function PopoverDescription({
  sx,
  ...props
}: Omit<PopoverPrimitive.Description.Props, "className"> & { sx?: Sx }) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      {...props}
      {...styleProps(styles.description, sx)}
    />
  )
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
