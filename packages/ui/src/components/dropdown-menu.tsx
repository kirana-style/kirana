import { css, props as styleProps } from "@kirana-style/core"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { menuItem, menuStyles } from "../recipes/menu"
import { overlayStyles } from "../recipes/overlay"
import { Icon } from "../primitives/icon"
import { dropdownMenuContentMarker } from "../theme/markers"

const styles = {
  /** Mirrors the submenu chevron when the document reads right to left. */
  chevron: css({ marginInlineStart: "auto" }),
}

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  sx,
  submenu,
  ...props
}: Omit<MenuPrimitive.Popup.Props, "className"> &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & {
    /** Sizes to its own content instead of matching the anchor's width. */
    submenu?: boolean
    sx?: Sx
  }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        {...styleProps(menuStyles.positioner)}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          {...props}
          {...styleProps(
            dropdownMenuContentMarker.anchor,
            overlayStyles.popup,
            menuStyles.content,
            menuStyles.glass,
            submenu ? menuStyles.submenu : menuStyles.anchored,
            sx
          )}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  sx,
  inset,
  ...props
}: Omit<MenuPrimitive.GroupLabel.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      {...props}
      {...styleProps(menuStyles.label, inset && menuStyles.labelInset, sx)}
    />
  )
}

function DropdownMenuItem({
  sx,
  inset,
  variant = "default",
  ...props
}: Omit<MenuPrimitive.Item.Props, "className"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  sx?: Sx
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
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

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  sx,
  inset,
  children,
  ...props
}: Omit<MenuPrimitive.SubmenuTrigger.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
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
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "inline-end",
  sideOffset = 0,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      submenu
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  sx,
  children,
  checked,
  inset,
  ...props
}: Omit<MenuPrimitive.CheckboxItem.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
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
        data-slot="dropdown-menu-checkbox-item-indicator"
        sx={menuStyles.indicator}
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <Icon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  sx,
  children,
  inset,
  ...props
}: Omit<MenuPrimitive.RadioItem.Props, "className"> & {
  inset?: boolean
  sx?: Sx
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
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
        data-slot="dropdown-menu-radio-item-indicator"
        sx={menuStyles.indicator}
      >
        <MenuPrimitive.RadioItemIndicator>
          <Icon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  sx,
  ...props
}: Omit<MenuPrimitive.Separator.Props, "className"> & { sx?: Sx }) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      {...props}
      {...styleProps(menuStyles.separator, sx)}
    />
  )
}

function DropdownMenuShortcut({
  sx,
  ...props
}: Omit<React.ComponentProps<"span">, "className"> & { sx?: Sx }) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      {...props}
      sx={[menuStyles.shortcut, sx]}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
