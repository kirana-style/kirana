import { css, props as styleProps } from "@kirana-style/core"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { menuItem, menuStyles } from "../recipes/menu"
import { overlayStyles } from "../recipes/overlay"
import { Icon } from "../primitives/icon"
import { spacing } from "../tokens/spacing"

/** Shares the menu recipe with DropdownMenu, so the two agree by construction. */

const styles = {
  trigger: css({ userSelect: "none" }),
  content: css({ minWidth: spacing[36] }),
  chevron: css({ marginInlineStart: "auto" }),
}

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuPortal({ ...props }: ContextMenuPrimitive.Portal.Props) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  )
}

function ContextMenuTrigger({
  sx,
  ...props
}: Omit<ContextMenuPrimitive.Trigger.Props, "className"> & { sx?: Sx }) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      {...props}
      {...styleProps(styles.trigger, sx)}
    />
  )
}

function ContextMenuContent({
  sx,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  ...props
}: Omit<ContextMenuPrimitive.Popup.Props, "className"> &
  Pick<
    ContextMenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { sx?: Sx }) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        {...styleProps(menuStyles.positioner)}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          {...props}
          {...styleProps(
            overlayStyles.popup,
            menuStyles.content,
            styles.content,
            sx
          )}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  )
}

function ContextMenuLabel({
  sx,
  inset,
  ...props
}: Omit<ContextMenuPrimitive.GroupLabel.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={inset}
      {...props}
      {...styleProps(menuStyles.label, inset && menuStyles.labelInset, sx)}
    />
  )
}

function ContextMenuItem({
  sx,
  inset,
  variant = "default",
  ...props
}: Omit<ContextMenuPrimitive.Item.Props, "className"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  sx?: Sx
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      {...props}
      {...styleProps(
        ...menuItem({ variant }),
        inset && menuStyles.itemInset,
        sx
      )}
    />
  )
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
  return (
    <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
  )
}

function ContextMenuSubTrigger({
  sx,
  inset,
  children,
  ...props
}: Omit<ContextMenuPrimitive.SubmenuTrigger.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        inset && menuStyles.itemInset,
        sx
      )}
    >
      {children}
      <Icon icon={ArrowRight01Icon} strokeWidth={2} sx={styles.chevron} />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "inline-end",
  sideOffset = 0,
  ...props
}: React.ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  sx,
  children,
  checked,
  inset,
  ...props
}: Omit<ContextMenuPrimitive.CheckboxItem.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      data-inset={inset}
      checked={checked}
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        menuStyles.itemCheckable,
        inset && menuStyles.itemInset,
        sx
      )}
    >
      <span
        data-slot="context-menu-checkbox-item-indicator"
        sx={menuStyles.indicator}
      >
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <Icon icon={Tick02Icon} strokeWidth={2} />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioGroup({
  ...props
}: ContextMenuPrimitive.RadioGroup.Props) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  )
}

function ContextMenuRadioItem({
  sx,
  children,
  inset,
  ...props
}: Omit<ContextMenuPrimitive.RadioItem.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      data-inset={inset}
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        menuStyles.itemCheckable,
        inset && menuStyles.itemInset,
        sx
      )}
    >
      <span
        data-slot="context-menu-radio-item-indicator"
        sx={menuStyles.indicator}
      >
        <ContextMenuPrimitive.RadioItemIndicator>
          <Icon icon={Tick02Icon} strokeWidth={2} />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

function ContextMenuSeparator({
  sx,
  ...props
}: Omit<ContextMenuPrimitive.Separator.Props, "className"> & { sx?: Sx }) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      {...props}
      {...styleProps(menuStyles.separator, sx)}
    />
  )
}

function ContextMenuShortcut({
  sx,
  ...props
}: Omit<React.ComponentProps<"span">, "className"> & { sx?: Sx }) {
  return (
    <span
      data-slot="context-menu-shortcut"
      {...props}
      sx={[menuStyles.shortcut, sx]}
    />
  )
}

export {
  ContextMenu,
  ContextMenuPortal,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
}
