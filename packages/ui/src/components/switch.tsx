import { css, props as styleProps } from "@kirana-style/core"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import type { Sx } from "../lib/sx"
import { fieldLabelMarker, peer, switchMarker } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"

/**
 * The thumb sizes according to the track it sits in. Only the small track needs
 * a query — the default size is the thumb's own default.
 */

/**
 * Hand-measured track geometry, carried over from the original. These are not on
 * the spacing scale because the thumb has to clear the track by exactly one
 * pixel at both sizes.
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
      "[data-checked]": theme.primary,
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
    cursor: { "[data-disabled]": "not-allowed" },
    opacity: { "[data-disabled]": 0.5 },
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
      "[data-checked]": surface.switchThumbChecked,
    },
    // `translate` respects writing direction, so one value covers LTR and RTL —
    // the original needed four `rtl:` overrides to say the same thing.
    translate: {
      base: "0",
      "[data-checked]": `calc(100% - 2px)`,
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
