import { css } from "@kirana-style/core"
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { Icon } from "../primitives/icon"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"

const CLAMPED_MD_10 = `min(${radius.md}, 10px)`

const styles = {
  wrapper: css({
    position: "relative",
    width: "fit-content",
    // The wrapper dims as a whole so the chevron fades with the field.
    opacity: { ":has(select:disabled)": 0.5 },
  }),
  select: css({
    height: { base: spacing[8], '[data-size="sm"]': spacing[7] },
    width: "100%",
    minWidth: 0,
    appearance: "none",
    borderRadius: { base: radius.lg, '[data-size="sm"]': CLAMPED_MD_10 },
    borderWidth: "1px",
    borderStyle: "solid",
    paddingBlock: { base: spacing[1], '[data-size="sm"]': spacing["0.5"] },
    paddingInlineStart: spacing["2.5"],
    // Room for the chevron.
    paddingInlineEnd: spacing[8],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    userSelect: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,

    "::selection": {
      backgroundColor: theme.primary,
      color: theme.primaryForeground,
    },
    "::placeholder": { color: theme.mutedForeground },

    backgroundColor: {
      base: surface.control,
      ":hover": surface.controlHover,
    },
    borderColor: {
      base: theme.input,
      ":focus-visible": theme.ring,
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
    pointerEvents: { ":disabled": "none" },
    cursor: { ":disabled": "not-allowed" },
  }),
  icon: css({
    pointerEvents: "none",
    position: "absolute",
    insetInlineEnd: spacing["2.5"],
    top: "50%",
    translate: "0 -50%",
    color: theme.mutedForeground,
    userSelect: "none",
  }),
  // The native popup is painted by the OS, so its options must use the system
  // palette rather than ours or they become unreadable in the opposite mode.
  option: css({ backgroundColor: "Canvas", color: "CanvasText" }),
}

type NativeSelectProps = Omit<
  React.ComponentProps<"select">,
  "size" | "className"
> & {
  size?: "sm" | "default"
  sx?: Sx
}

function NativeSelect({ sx, size = "default", ...props }: NativeSelectProps) {
  return (
    <div
      data-slot="native-select-wrapper"
      data-size={size}
      sx={[styles.wrapper, sx]}
    >
      <select
        data-slot="native-select"
        data-size={size}
        {...props}
        sx={styles.select}
      />
      <Icon
        icon={UnfoldMoreIcon}
        strokeWidth={2}
        size="1rem"
        data-slot="native-select-icon"
        sx={styles.icon}
      />
    </div>
  )
}

function NativeSelectOption({
  sx,
  ...props
}: Omit<React.ComponentProps<"option">, "className"> & { sx?: Sx }) {
  return (
    <option
      data-slot="native-select-option"
      {...props}
      sx={[styles.option, sx]}
    />
  )
}

function NativeSelectOptGroup({
  sx,
  ...props
}: Omit<React.ComponentProps<"optgroup">, "className"> & { sx?: Sx }) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      {...props}
      sx={[styles.option, sx]}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
