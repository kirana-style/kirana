import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { toggle } from "../recipes/toggle"
import { radius } from "../theme/semantic"
import { spacing } from "../tokens/spacing"

type ToggleVariants = VariantProps<typeof toggle>

const ToggleGroupContext = React.createContext<
  ToggleVariants & {
    spacing?: 0 | 1 | 2
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
})

const CLAMPED_MD_10 = `min(${radius.md}, 10px)`

const styles = {
  group: css({
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    borderRadius: { base: radius.lg, '[data-size="sm"]': CLAMPED_MD_10 },
    // The original passed the gap through an inline `--gap` custom property and
    // read it back with `gap-[--spacing(var(--gap))]`. Three discrete values do
    // not need a variable.
    gap: {
      base: spacing[2],
      '[data-spacing="1"]': spacing[1],
      '[data-spacing="0"]': spacing[0],
    },
    flexDirection: {
      base: "row",
      '[data-orientation="vertical"]': "column",
    },
  }),
  groupVertical: css({ alignItems: "stretch" }),

  item: css({
    flexShrink: 0,
    // Raising the focused item keeps its ring above the neighbour it overlaps.
    zIndex: { ":focus": 10, ":focus-visible": 10 },
  }),

  /**
   * `spacing={0}`: the items butt together into one segmented control. Chosen
   * from the group context rather than written as `base: null` conditions
   * on every item, because a null base would erase the toggle recipe's own
   * padding and radius in the spaced case.
   */
  joined: css({
    borderRadius: 0,
    paddingInlineEnd: {
      base: spacing[2],
      ':has([data-icon="inline-end"])': spacing["1.5"],
    },
    paddingInlineStart: {
      base: spacing[2],
      ':has([data-icon="inline-start"])': spacing["1.5"],
    },
  }),
  /** Only the outer corners stay round, and neighbours share one border line. */
  joinedHorizontal: css({
    borderStartStartRadius: { base: 0, ":first-child": radius.lg },
    borderEndStartRadius: { base: 0, ":first-child": radius.lg },
    borderStartEndRadius: { base: 0, ":last-child": radius.lg },
    borderEndEndRadius: { base: 0, ":last-child": radius.lg },
  }),
  joinedVertical: css({
    borderStartStartRadius: { base: 0, ":first-child": radius.lg },
    borderStartEndRadius: { base: 0, ":first-child": radius.lg },
    borderEndStartRadius: { base: 0, ":last-child": radius.lg },
    borderEndEndRadius: { base: 0, ":last-child": radius.lg },
  }),
  joinedOutlineHorizontal: css({
    borderInlineStartWidth: { base: 0, ":first-child": "1px" },
  }),
  joinedOutlineVertical: css({
    borderTopWidth: { base: 0, ":first-child": "1px" },
  }),
}

function ToggleGroup({
  sx,
  variant,
  size,
  spacing: gap = 2,
  orientation = "horizontal",
  children,
  ...props
}: Omit<ToggleGroupPrimitive.Props, "className"> &
  ToggleVariants & {
    /**
     * The gap between items, on the spacing scale. `0` joins them into a single
     * segmented control.
     */
    spacing?: 0 | 1 | 2
    orientation?: "horizontal" | "vertical"
    sx?: Sx
  }) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={gap}
      data-orientation={orientation}
      // Base UI needs it too, or arrow keys move horizontally in a column.
      orientation={orientation}
      {...props}
      {...styleProps(
        styles.group,
        orientation === "vertical" && styles.groupVertical,
        sx
      )}
    >
      <ToggleGroupContext value={{ variant, size, spacing: gap, orientation }}>
        {children}
      </ToggleGroupContext>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  sx,
  children,
  variant = "default",
  size = "default",
  ...props
}: Omit<TogglePrimitive.Props, "className"> & ToggleVariants & { sx?: Sx }) {
  const context = React.useContext(ToggleGroupContext)
  const resolvedVariant = context.variant ?? variant
  const resolvedSize = context.size ?? size
  const joined = context.spacing === 0
  const vertical = context.orientation === "vertical"

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      data-spacing={context.spacing}
      {...props}
      {...styleProps(
        ...toggle({ variant: resolvedVariant, size: resolvedSize }),
        styles.item,
        joined && styles.joined,
        joined && (vertical ? styles.joinedVertical : styles.joinedHorizontal),
        joined &&
          resolvedVariant === "outline" &&
          (vertical
            ? styles.joinedOutlineVertical
            : styles.joinedOutlineHorizontal),
        sx
      )}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
