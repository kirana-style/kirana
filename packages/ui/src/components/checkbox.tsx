import { css, props as styleProps } from "@kirana-style/core"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import * as State from "@kirana-style/states/base-ui"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { Icon } from "../primitives/icon"
import { ctx } from "../theme/context"
import { fieldLabelMarker, fieldMarker, peer } from "../theme/markers"
import { alpha, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"

const styles = {
  root: css({
    position: "relative",
    display: "flex",
    width: spacing[4],
    height: spacing[4],
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    borderWidth: "1px",
    borderStyle: "solid",
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    [ctx.iconSize]: "0.875rem",

    // Enlarges the hit area well past the 16px box without changing layout.
    "::after": {
      content: "''",
      position: "absolute",
      insetInline: `calc(${spacing[3]} * -1)`,
      insetBlock: `calc(${spacing[2]} * -1)`,
    },

    backgroundColor: {
      base: surface.control,
      [State.Checkbox.Root.checked]: theme.primary,
    },
    borderColor: {
      base: theme.input,
      ":focus-visible": theme.ring,
      [State.Checkbox.Root.checked]: theme.primary,
      '[aria-invalid="true"]': {
        base: surface.borderInvalid,
        // An invalid *and* checked box keeps the primary edge, so the tick still
        // reads as a tick rather than as an error.
        [State.Checkbox.Root.checked]: theme.primary,
      },
    },
    color: { [State.Checkbox.Root.checked]: theme.primaryForeground },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
      [fieldLabelMarker.within(":focus-within")]: "none",
    },
    cursor: { ":disabled": "not-allowed" },
    opacity: {
      ":disabled": 0.5,
      [fieldMarker.within(":has(:disabled)")]: 0.5,
    },
  }),

  indicator: css({
    display: "grid",
    placeContent: "center",
    color: "currentColor",
  }),
}

function Checkbox({
  sx,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "className"> & { sx?: Sx }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      {...props}
      {...styleProps(peer.anchor, styles.root, sx)}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        {...styleProps(styles.indicator)}
      >
        <Icon icon={Tick02Icon} strokeWidth={2} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
