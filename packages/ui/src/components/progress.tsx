import { css, props as styleProps } from "@kirana-style/core"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import type { Sx } from "../lib/sx"
import { radius, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const styles = {
  root: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
  track: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    height: spacing[1],
    width: "100%",
    overflowX: "hidden",
    borderRadius: radius.full,
    backgroundColor: theme.muted,
  }),
  indicator: css({
    height: "100%",
    backgroundColor: theme.primary,
    transitionProperty: "inline-size, transform",
    transitionDuration: duration[300],
    transitionTimingFunction: easing.inOut,
  }),
  label: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
  value: css({
    marginInlineStart: "auto",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
    fontVariantNumeric: "tabular-nums",
  }),
}

function Progress({
  sx,
  indicatorSx,
  children,
  value,
  ...props
}: Omit<ProgressPrimitive.Root.Props, "className"> & {
  sx?: Sx
  /** Styles the filled bar, which Progress renders for you. */
  indicatorSx?: Sx
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      {...props}
      {...styleProps(styles.root, sx)}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator sx={indicatorSx} />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({
  sx,
  ...props
}: Omit<ProgressPrimitive.Track.Props, "className"> & { sx?: Sx }) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      {...props}
      {...styleProps(styles.track, sx)}
    />
  )
}

function ProgressIndicator({
  sx,
  ...props
}: Omit<ProgressPrimitive.Indicator.Props, "className"> & { sx?: Sx }) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      {...props}
      {...styleProps(styles.indicator, sx)}
    />
  )
}

function ProgressLabel({
  sx,
  ...props
}: Omit<ProgressPrimitive.Label.Props, "className"> & { sx?: Sx }) {
  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      {...props}
      {...styleProps(styles.label, sx)}
    />
  )
}

function ProgressValue({
  sx,
  ...props
}: Omit<ProgressPrimitive.Value.Props, "className"> & { sx?: Sx }) {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      {...props}
      {...styleProps(styles.value, sx)}
    />
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
}
