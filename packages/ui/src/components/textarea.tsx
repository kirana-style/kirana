import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { controlStyles } from "../recipes/control"
import { breakpoint } from "../tokens/breakpoints"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"

const styles = {
  root: css({
    display: "flex",
    // Grows with its content instead of scrolling.
    fieldSizing: "content",
    minHeight: spacing[16],
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[2],
    fontSize: { base: fontSize.base, [breakpoint.md]: fontSize.sm },
    lineHeight: { base: lineHeight.base, [breakpoint.md]: lineHeight.sm },
  }),
}

function Textarea({
  sx,
  ...props
}: Omit<React.ComponentProps<"textarea">, "className"> & { sx?: Sx }) {
  return (
    <textarea
      data-slot="textarea"
      {...props}
      sx={[controlStyles.field, controlStyles.placeholder, styles.root, sx]}
    />
  )
}

export { Textarea }
