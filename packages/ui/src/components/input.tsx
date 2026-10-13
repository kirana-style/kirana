import { css, props as styleProps } from "@kirana-style/core"
import { Input as InputPrimitive } from "@base-ui/react/input"

import type { Sx } from "../lib/sx"
import { groupedFill, groupedItem } from "../recipes/button-group"
import { controlStyles } from "../recipes/control"
import { theme } from "../theme/semantic"
import { breakpoint } from "../tokens/breakpoints"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const styles = {
  root: css({
    height: spacing[8],
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[1],
    // Was `text-base md:text-sm`: larger on touch to stop iOS zooming the page.
    fontSize: { base: fontSize.base, [breakpoint.md]: fontSize.sm },
    lineHeight: { base: lineHeight.base, [breakpoint.md]: lineHeight.sm },
    pointerEvents: { ":disabled": "none" },
  }),
  // `file:` utilities, as a real pseudo-element.
  file: css({
    "::file-selector-button": {
      display: "inline-flex",
      height: spacing[6],
      borderWidth: 0,
      backgroundColor: "transparent",
      fontSize: fontSize.sm,
      lineHeight: lineHeight.sm,
      fontWeight: fontWeight.medium,
      color: theme.foreground,
    },
  }),
}

function Input({
  sx,
  type,
  ...props
}: Omit<React.ComponentProps<"input">, "className"> & { sx?: Sx }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      {...props}
      {...styleProps(
        controlStyles.field,
        controlStyles.placeholder,
        styles.root,
        styles.file,
        groupedItem,
        groupedFill,
        sx
      )}
    />
  )
}

export { Input }
