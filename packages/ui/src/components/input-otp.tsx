import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { OTPInput, OTPInputContext } from "input-otp"
import { MinusSignIcon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { Icon } from "../primitives/icon"
import { animation } from "../theme/animations"
import { ctx } from "../theme/context"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"

const styles = {
  container: css({
    display: "flex",
    alignItems: "center",
    opacity: { ":has(:disabled)": 0.5 },
  }),
  input: css({ cursor: { ":disabled": "not-allowed" } }),

  group: css({
    display: "flex",
    alignItems: "center",
    borderRadius: radius.lg,
    // The group shows the error, not each slot.
    borderColor: {
      // Full strength in both modes: only the ring softens in dark.
      ':has([aria-invalid="true"])': theme.destructive,
    },
    boxShadow: {
      ':has([aria-invalid="true"])': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
  }),

  slot: css({
    position: "relative",
    display: "flex",
    width: spacing[8],
    height: spacing[8],
    alignItems: "center",
    justifyContent: "center",
    borderBlockWidth: "1px",
    borderInlineEndWidth: "1px",
    borderStyle: "solid",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    backgroundColor: surface.control,

    // Only the outer edges of the strip are rounded, and only the first slot
    // draws a leading border — the rest share their neighbour's.
    borderStartStartRadius: { base: 0, ":first-child": radius.lg },
    borderEndStartRadius: { base: 0, ":first-child": radius.lg },
    borderStartEndRadius: { base: 0, ":last-child": radius.lg },
    borderEndEndRadius: { base: 0, ":last-child": radius.lg },
    borderInlineStartWidth: { base: 0, ":first-child": "1px" },

    borderColor: {
      base: theme.input,
      '[aria-invalid="true"]': theme.destructive,
      '[data-active="true"]': theme.ring,
      '[data-active="true"][aria-invalid="true"]': theme.destructive,
    },
    boxShadow: {
      '[data-active="true"]': `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[data-active="true"][aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
    // The active slot rises so its ring is not clipped by its neighbours.
    zIndex: { '[data-active="true"]': 10 },
  }),

  caretWrap: css({
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  caret: css({
    height: spacing[4],
    width: "1px",
    backgroundColor: theme.foreground,
    animationName: animation.caretBlink,
    animationDuration: duration[1000],
    animationIterationCount: "infinite",
  }),

  separator: css({
    display: "flex",
    alignItems: "center",
    [ctx.iconSize]: "1rem",
  }),
}

function InputOTP({
  sx,
  containerSx,
  ...props
}: Omit<
  React.ComponentProps<typeof OTPInput>,
  "className" | "containerClassName"
> & {
  sx?: Sx
  containerSx?: Sx
}) {
  // OTPInput's props are a union discriminated on `render` vs `children`, which
  // a JSX spread cannot narrow, so the object is assembled and cast in one go.
  const otpProps = {
    "data-slot": "input-otp",
    spellCheck: false,
    containerClassName: styleProps(styles.container, containerSx).className,
    className: styleProps(styles.input, sx).className,
    ...props,
  } as React.ComponentProps<typeof OTPInput>

  return <OTPInput {...otpProps} />
}

function InputOTPGroup({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return <div data-slot="input-otp-group" {...props} sx={[styles.group, sx]} />
}

function InputOTPSlot({
  index,
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  index: number
  sx?: Sx
}) {
  const context = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = context?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      {...props}
      sx={[styles.slot, sx]}
    >
      {char}
      {hasFakeCaret && (
        <div sx={styles.caretWrap}>
          <div sx={styles.caret} />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      {...props}
      sx={[styles.separator, sx]}
    >
      <Icon icon={MinusSignIcon} strokeWidth={2} />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
