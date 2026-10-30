import { css, props as styleProps } from "@kirana-style/core"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import * as State from "@kirana-style/states/base-ui"

import type { Sx } from "../lib/sx"
import { fieldLabelMarker, peer, switchMarker } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"

/**
 * Hand-measured track geometry, off the spacing scale because the thumb has to
 * clear the track by exactly one pixel at both sizes.
 */
const TRACK = {
  default: { width: "32px", height: "18.4px" },
  sm: { width: "24px", height: "14px" },
} as const

const styles = {
  root: css({
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    outlineStyle: "none",
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,

    "::after": {
      content: "''",
      position: "absolute",
      insetInline: `calc(${spacing[3]} * -1)`,
      insetBlock: `calc(${spacing[2]} * -1)`,
    },

    width: {
      base: TRACK.default.width,
      '[data-size="sm"]': TRACK.sm.width,
    },
    height: {
      base: TRACK.default.height,
      '[data-size="sm"]': TRACK.sm.height,
    },
    backgroundColor: {
      base: surface.switchTrack,
      [State.Switch.Root.checked]: theme.primary,
    },
    borderColor: {
      base: "transparent",
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
      [fieldLabelMarker.within(":focus-within")]: "transparent",
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
      [fieldLabelMarker.within(":focus-within")]: "none",
    },
    cursor: { [State.Switch.Root.disabled]: "not-allowed" },
    opacity: { [State.Switch.Root.disabled]: 0.5 },
  }),

  thumb: css({
    pointerEvents: "none",
    display: "block",
    borderRadius: radius.full,
    // `translate`, not `transform`: they are separate properties, and naming
    // the wrong one means the thumb jumps instead of sliding.
    transitionProperty: "translate, background-color",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,

    width: {
      base: spacing[4],
      [switchMarker.within('[data-size="sm"]')]: spacing[3],
    },
    height: {
      base: spacing[4],
      [switchMarker.within('[data-size="sm"]')]: spacing[3],
    },
    backgroundColor: {
      base: surface.switchThumb,
      [State.Switch.Thumb.checked]: surface.switchThumbChecked,
    },
    // `translate` is physical: in right-to-left text the track starts on the
    // right, so the checked thumb moves left.
    translate: {
      base: "0",
      [State.Switch.Thumb.checked]: {
        base: "calc(100% - 2px)",
        ":dir(rtl)": "calc(2px - 100%)",
      },
    },
  }),
}

function Switch({
  sx,
  size = "default",
  ...props
}: Omit<SwitchPrimitive.Root.Props, "className"> & {
  size?: "sm" | "default"
  sx?: Sx
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      {...props}
      {...styleProps(switchMarker.anchor, peer.anchor, styles.root, sx)}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        {...styleProps(styles.thumb)}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
