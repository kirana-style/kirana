import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import { menuItem, menuStyles } from "../recipes/menu"
import { overlayStyles } from "../recipes/overlay"
import { Button } from "./button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group"
import { Icon } from "../primitives/icon"
import { ctx, menuCtx } from "../theme/context"
import { comboboxContentMarker, inputGroupMarker } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/** A clear button present means the dropdown trigger steps aside. */
/** The empty state only shows when the list found nothing. */

const styles = {
  trigger: css({ [ctx.iconSize]: "1rem" }),
  triggerIcon: css({ pointerEvents: "none", color: theme.mutedForeground }),
  // The input group's own trigger: it steps aside for the clear button, and a
  // pressed trigger has no fill. The ghost button's hover fill merges in beside.
  triggerHidden: css({
    display: {
      base: "flex",
      [inputGroupMarker.within(':has([data-slot="combobox-clear"])')]: "none",
    },
    backgroundColor: { "[data-pressed]": "transparent" },
  }),

  inputGroup: css({ width: "auto" }),

  content: css({
    minWidth: `calc(var(--anchor-width) + ${spacing[7]})`,
    maxWidth: "var(--available-width)",
    overflow: "hidden",
    padding: 0,
  }),
  contentChips: css({ minWidth: "var(--anchor-width)" }),

  list: css({
    // Leaves room for the search field above without overflowing the viewport.
    maxHeight: `min(calc(${spacing[72]} - ${spacing[9]}), calc(var(--available-height) - ${spacing[9]}))`,
    scrollPaddingBlock: spacing[1],
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: { base: spacing[1], "[data-empty]": 0 },
    scrollbarWidth: "none",
    "::-webkit-scrollbar": { display: "none" },
  }),

  item: css({ width: "100%" }),
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
  label: css({
    paddingInline: spacing[2],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  empty: css({
    display: {
      base: "none",
      [comboboxContentMarker.within("[data-empty]")]: "flex",
    },
    width: "100%",
    justifyContent: "center",
    paddingBlock: spacing[2],
    textAlign: "center",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  separator: css({
    marginInline: `calc(${spacing[1]} * -1)`,
    marginBlock: spacing[1],
    height: "1px",
    backgroundColor: menuCtx.separator,
  }),

  chips: css({
    display: "flex",
    minHeight: spacing[8],
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing[1],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    backgroundClip: "padding-box",
    paddingBlock: spacing[1],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    backgroundColor: surface.control,
    paddingInline: {
      base: spacing["2.5"],
      ':has([data-slot="combobox-chip"])': spacing[1],
    },
    borderColor: {
      base: theme.input,
      ":focus-within": theme.ring,
      ':has([aria-invalid="true"])': surface.borderInvalid,
    },
    boxShadow: {
      ":focus-within": `0 0 0 ${ring.width} ${alpha.ring50}`,
      ':has([aria-invalid="true"])': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
  }),

  chip: css({
    display: "flex",
    // 5.25 steps on the spacing scale, which has no named entry.
    height: "1.3125rem",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    borderRadius: radius.sm,
    backgroundColor: theme.muted,
    paddingInline: spacing["1.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
    color: theme.foreground,
    paddingInlineEnd: {
      base: spacing["1.5"],
      ':has([data-slot="combobox-chip-remove"])': 0,
    },
    pointerEvents: { ":has(:disabled)": "none" },
    cursor: { ":has(:disabled)": "not-allowed" },
    opacity: { ":has(:disabled)": 0.5 },
  }),
  chipRemove: css({
    marginInlineStart: `calc(${spacing[1]} * -1)`,
    opacity: { base: 0.5, ":hover": 1 },
  }),
  chipsInput: css({ minWidth: spacing[16], flex: 1, outlineStyle: "none" }),
}

const Combobox = ComboboxPrimitive.Root

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

function ComboboxTrigger({
  sx,
  children,
  ...props
}: Omit<ComboboxPrimitive.Trigger.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      {...props}
      {...styleProps(styles.trigger, sx)}
    >
      {children}
      <Icon icon={ArrowDown01Icon} strokeWidth={2} sx={styles.triggerIcon} />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxClear({
  ...props
}: Omit<ComboboxPrimitive.Clear.Props, "className">) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      {...props}
    >
      <Icon icon={Cancel01Icon} strokeWidth={2} />
    </ComboboxPrimitive.Clear>
  )
}

function ComboboxInput({
  sx,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  inputSx,
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "className"> & {
  showTrigger?: boolean
  showClear?: boolean
  /** Styles the group around the input and its buttons. */
  sx?: Sx
  /** Styles the text input itself. */
  inputSx?: Sx
}) {
  return (
    <InputGroup sx={mergeSx(styles.inputGroup, sx)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} sx={inputSx} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          // The trigger renders the button, not the other way round: a styled
          // component used as a `render` element keeps its own classes and
          // drops the ones handed to it.
          <ComboboxPrimitive.Trigger
            data-slot="input-group-button"
            disabled={disabled}
            render={
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                sx={mergeSx(styles.trigger, styles.triggerHidden)}
              />
            }
          >
            <Icon icon={ArrowDown01Icon} sx={styles.triggerIcon} />
          </ComboboxPrimitive.Trigger>
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  sx,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: Omit<ComboboxPrimitive.Popup.Props, "className"> &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  > & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        {...styleProps(menuStyles.positioner)}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          {...props}
          {...styleProps(
            comboboxContentMarker.anchor,
            overlayStyles.popup,
            menuStyles.content,
            menuStyles.glass,
            menuStyles.anchored,
            styles.content,
            anchor && styles.contentChips,
            sx
          )}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({
  sx,
  ...props
}: Omit<ComboboxPrimitive.List.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      {...props}
      {...styleProps(styles.list, sx)}
    />
  )
}

function ComboboxItem({
  sx,
  children,
  ...props
}: Omit<ComboboxPrimitive.Item.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        menuStyles.itemCheckable,
        styles.item,
        sx
      )}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator render={<span sx={styles.indicator} />}>
        <Icon icon={Tick02Icon} strokeWidth={2} />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({
  sx,
  ...props
}: Omit<ComboboxPrimitive.Group.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      {...props}
      {...styleProps(sx)}
    />
  )
}

function ComboboxLabel({
  sx,
  ...props
}: Omit<ComboboxPrimitive.GroupLabel.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      {...props}
      {...styleProps(styles.label, sx)}
    />
  )
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  )
}

function ComboboxEmpty({
  sx,
  ...props
}: Omit<ComboboxPrimitive.Empty.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      {...props}
      {...styleProps(styles.empty, sx)}
    />
  )
}

function ComboboxSeparator({
  sx,
  ...props
}: Omit<ComboboxPrimitive.Separator.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      {...props}
      {...styleProps(styles.separator, sx)}
    />
  )
}

function ComboboxChips({
  sx,
  ...props
}: Omit<
  React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
    ComboboxPrimitive.Chips.Props,
  "className"
> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      {...props}
      {...styleProps(styles.chips, sx)}
    />
  )
}

function ComboboxChip({
  sx,
  children,
  showRemove = true,
  ...props
}: Omit<ComboboxPrimitive.Chip.Props, "className"> & {
  showRemove?: boolean
  sx?: Sx
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      {...props}
      {...styleProps(styles.chip, sx)}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={
            <Button variant="ghost" size="icon-xs" sx={styles.chipRemove} />
          }
          data-slot="combobox-chip-remove"
        >
          <Icon icon={Cancel01Icon} strokeWidth={2} />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({
  sx,
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "className"> & { sx?: Sx }) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      {...props}
      {...styleProps(styles.chipsInput, sx)}
    />
  )
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
