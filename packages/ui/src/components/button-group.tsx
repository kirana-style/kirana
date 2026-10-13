import { css, props as styleProps } from "@kirana-style/core"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { buttonGroup, groupedItem } from "../recipes/button-group"
import { Separator } from "./separator"
import { ctx } from "../theme/context"
import { buttonGroupMarker } from "../theme/button-group-marker"
import { radius, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const styles = {
  text: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.muted,
    paddingInline: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    [ctx.iconSize]: "1rem",
  }),
  separator: css({
    position: "relative",
    alignSelf: "stretch",
    backgroundColor: theme.input,
    marginInline: { '[data-orientation="horizontal"]': "1px" },
    width: { '[data-orientation="horizontal"]': "auto" },
    marginBlock: { '[data-orientation="vertical"]': "1px" },
    height: { '[data-orientation="vertical"]': "auto" },
  }),
}

function ButtonGroup({
  sx,
  orientation,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> &
  VariantProps<typeof buttonGroup> & { sx?: Sx }) {
  return (
    <div
      role="group"
      data-slot="button-group"
      // Only when given, as in the original. The recipe still defaults to
      // horizontal, but an unset attribute keeps a Field's
      // `:has([data-orientation="horizontal"])` balance rule from firing.
      data-orientation={orientation}
      {...props}
      sx={[buttonGroupMarker.anchor, ...buttonGroup({ orientation }), sx]}
    />
  )
}

function ButtonGroupText({
  sx,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(styleProps(styles.text, groupedItem, sx), props),
    render,
    state: { slot: "button-group-text" },
  })
}

function ButtonGroupSeparator({
  sx,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      {...props}
      sx={mergeSx(styles.separator, sx)}
    />
  )
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroup as buttonGroupVariants,
}
