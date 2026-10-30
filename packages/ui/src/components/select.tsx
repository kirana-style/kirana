import { css, props as styleProps } from "@kirana-style/core"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import * as State from "@kirana-style/states/base-ui"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { groupedItem } from "../recipes/button-group"
import { menuItem, menuStyles } from "../recipes/menu"
import { overlayStyles } from "../recipes/overlay"
import { Icon } from "../primitives/icon"
import { ctx, menuCtx } from "../theme/context"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"

const CLAMPED_MD_10 = `min(${radius.md}, 10px)`

const styles = {
  group: css({ scrollMarginBlock: spacing[1], padding: spacing[1] }),
  value: css({
    display: "flex",
    flex: 1,
    alignItems: "center",
    gap: spacing["1.5"],
    textAlign: "start",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),

  trigger: css({
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing["1.5"],
    borderWidth: "1px",
    borderStyle: "solid",
    paddingBlock: spacing[2],
    paddingInlineStart: spacing["2.5"],
    paddingInlineEnd: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    whiteSpace: "nowrap",
    outlineStyle: "none",
    userSelect: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    [ctx.iconSize]: "1rem",

    height: { base: spacing[8], '[data-size="sm"]': spacing[7] },
    borderRadius: { base: radius.lg, '[data-size="sm"]': CLAMPED_MD_10 },
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
    color: { [State.Select.Trigger.placeholder]: theme.mutedForeground },
    cursor: { ":disabled": "not-allowed" },
    opacity: { ":disabled": 0.5 },
  }),
  triggerIcon: css({ pointerEvents: "none", color: theme.mutedForeground }),

  content: css({ minWidth: spacing[36], padding: 0 }),
  label: css({
    paddingInline: spacing["1.5"],
    paddingBlock: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  item: css({ width: "100%" }),
  itemText: css({
    display: "flex",
    flex: 1,
    flexShrink: 0,
    gap: spacing[2],
    whiteSpace: "nowrap",
  }),
  indicator: css({
    pointerEvents: "none",
    position: "absolute",
    insetInlineEnd: spacing[2],
    display: "flex",
    width: spacing[4],
    height: spacing[4],
    alignItems: "center",
    justifyContent: "center",
  }),
  separator: css({
    pointerEvents: "none",
    marginInline: `calc(${spacing[1]} * -1)`,
    marginBlock: spacing[1],
    height: "1px",
    backgroundColor: menuCtx.separator,
  }),
  scrollArrow: css({
    zIndex: 10,
    display: "flex",
    width: "100%",
    cursor: "default",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.popover,
    paddingBlock: spacing[1],
    [ctx.iconSize]: "1rem",
  }),
  scrollUp: css({ top: 0 }),
  scrollDown: css({ bottom: 0 }),
}

const Select = SelectPrimitive.Root

function SelectGroup({
  sx,
  ...props
}: Omit<SelectPrimitive.Group.Props, "className"> & { sx?: Sx }) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      {...props}
      {...styleProps(styles.group, sx)}
    />
  )
}

function SelectValue({
  sx,
  ...props
}: Omit<SelectPrimitive.Value.Props, "className"> & { sx?: Sx }) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      {...props}
      {...styleProps(styles.value, sx)}
    />
  )
}

function SelectTrigger({
  sx,
  size = "default",
  children,
  ...props
}: Omit<SelectPrimitive.Trigger.Props, "className"> & {
  size?: "sm" | "default"
  sx?: Sx
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      {...props}
      {...styleProps(styles.trigger, groupedItem, sx)}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <Icon icon={UnfoldMoreIcon} strokeWidth={2} sx={styles.triggerIcon} />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  sx,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: Omit<SelectPrimitive.Popup.Props, "className"> &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  > & { sx?: Sx }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        {...styleProps(menuStyles.positioner)}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          {...props}
          {...styleProps(
            alignItemWithTrigger ? overlayStyles.modal : overlayStyles.popup,
            menuStyles.content,
            menuStyles.glass,
            menuStyles.anchored,
            styles.content,
            sx
          )}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  sx,
  ...props
}: Omit<SelectPrimitive.GroupLabel.Props, "className"> & { sx?: Sx }) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      {...props}
      {...styleProps(styles.label, sx)}
    />
  )
}

function SelectItem({
  sx,
  children,
  ...props
}: Omit<SelectPrimitive.Item.Props, "className"> & { sx?: Sx }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        menuStyles.itemCheckable,
        styles.item,
        sx
      )}
    >
      <SelectPrimitive.ItemText {...styleProps(styles.itemText)}>
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span sx={styles.indicator} />}>
        <Icon icon={Tick02Icon} strokeWidth={2} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  sx,
  ...props
}: Omit<SelectPrimitive.Separator.Props, "className"> & { sx?: Sx }) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      {...props}
      {...styleProps(styles.separator, sx)}
    />
  )
}

function SelectScrollUpButton({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>,
  "className"
> & { sx?: Sx }) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      {...props}
      {...styleProps(styles.scrollArrow, styles.scrollUp, sx)}
    >
      <Icon icon={ArrowUp01Icon} strokeWidth={2} />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>,
  "className"
> & { sx?: Sx }) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      {...props}
      {...styleProps(styles.scrollArrow, styles.scrollDown, sx)}
    >
      <Icon icon={ArrowDown01Icon} strokeWidth={2} />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
