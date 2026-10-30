import { css, props as styleProps } from "@kirana-style/core"
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import type { Sx } from "../lib/sx"
import { theme } from "../theme/semantic"

const styles = {
  root: css({
    flexShrink: 0,
    backgroundColor: theme.border,
  }),
  orientation: css({
    height: { '[data-orientation="horizontal"]': "1px" },
    width: {
      '[data-orientation="horizontal"]': "100%",
      '[data-orientation="vertical"]': "1px",
    },
    alignSelf: { '[data-orientation="vertical"]': "stretch" },
  }),
}

function Separator({
  sx,
  orientation = "horizontal",
  ...props
}: Omit<SeparatorPrimitive.Props, "className"> & { sx?: Sx }) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      {...props}
      {...styleProps(styles.root, styles.orientation, sx)}
    />
  )
}

export { Separator }
