import { css, props as styleProps } from "@kirana-style/core"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import type { Sx } from "../lib/sx"
import { alpha, radius, theme } from "../theme/semantic"
import { color } from "../tokens/colors"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"

const styles = {
  root: css({
    width: { '[data-orientation="horizontal"]': "100%" },
    height: { '[data-orientation="vertical"]': "100%" },
  }),
  control: css({
    position: "relative",
    display: "flex",
    width: "100%",
    touchAction: "none",
    alignItems: "center",
    userSelect: "none",
    opacity: { "[data-disabled]": 0.5 },
    height: { '[data-orientation="vertical"]': "100%" },
    minHeight: { '[data-orientation="vertical"]': spacing[40] },
    flexDirection: { '[data-orientation="vertical"]': "column" },
  }),
  track: css({
    position: "relative",
    flexGrow: 1,
    overflow: "hidden",
    borderRadius: radius.full,
    backgroundColor: theme.muted,
    userSelect: "none",
    height: {
      '[data-orientation="horizontal"]': spacing[1],
      '[data-orientation="vertical"]': "100%",
    },
    width: {
      '[data-orientation="horizontal"]': "100%",
      '[data-orientation="vertical"]': spacing[1],
    },
  }),
  indicator: css({
    backgroundColor: theme.primary,
    userSelect: "none",
    height: { '[data-orientation="horizontal"]': "100%" },
    width: { '[data-orientation="vertical"]': "100%" },
  }),
  thumb: css({
    position: "relative",
    display: "block",
    width: spacing[3],
    height: spacing[3],
    flexShrink: 0,
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.ring,
    // The original hardcodes white here rather than using a token, so the
    // dot reads the same against either palette.
    backgroundColor: color.white,
    userSelect: "none",
    outlineStyle: "none",
    transitionProperty: "color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    // Was `after:-inset-2`: widens the pointer target past the visible dot.
    "::after": {
      content: "''",
      position: "absolute",
      inset: `calc(${spacing[2]} * -1)`,
    },
    boxShadow: {
      ":hover": `0 0 0 ${ring.width} ${alpha.ring50}`,
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      ":active": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
    pointerEvents: { ":disabled": "none" },
    opacity: { ":disabled": 0.5 },
  }),
}

function Slider({
  sx,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: Omit<SliderPrimitive.Root.Props, "className"> & { sx?: Sx }) {
  const values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
      {...styleProps(styles.root, sx)}
    >
      <SliderPrimitive.Control {...styleProps(styles.control)}>
        <SliderPrimitive.Track
          data-slot="slider-track"
          {...styleProps(styles.track)}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            {...styleProps(styles.indicator)}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            {...styleProps(styles.thumb)}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
