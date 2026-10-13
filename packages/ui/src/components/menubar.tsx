import { css, props as styleProps } from "@kirana-style/core"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { menuItem } from "../recipes/menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Icon } from "../primitives/icon"
import { radius, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/**
 * A Menubar is a row of DropdownMenus sharing keyboard focus, so most of its
 * parts are the dropdown's parts re-exported under menubar names. Only the bar
 * itself and its triggers are new.
 *
 * `pl-7` in the original assumed left-to-right text. These use logical padding,
 * so the indicator column is on the correct side in right-to-left layouts too.
 */

const styles = {
  root: css({
    display: "flex",
    height: spacing[8],
    alignItems: "center",
    gap: spacing["0.5"],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    padding: "3px",
  }),
  trigger: css({
    display: "flex",
    alignItems: "center",
    borderRadius: radius.sm,
    paddingInline: spacing["1.5"],
    paddingBlock: "2px",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    outlineStyle: "none",
    userSelect: "none",
    backgroundColor: {
      ":hover": theme.muted,
      '[aria-expanded="true"]': theme.muted,
    },
  }),
  // Was `min-w-36` on the menubar's popup, wider than a dropdown's.
  content: css({ minWidth: spacing[36] }),
  // Was `min-w-32` on its submenus, where a dropdown's are 96px.
  subContent: css({ minWidth: spacing[32] }),
  /** The indicator sits in a reserved leading column rather than trailing. */
  itemLeading: css({
    paddingInlineStart: spacing[7],
    paddingInlineEnd: spacing["1.5"],
  }),
  indicator: css({
    pointerEvents: "none",
    position: "absolute",
    insetInlineStart: spacing["1.5"],
    display: "flex",
    width: spacing[4],
    height: spacing[4],
    alignItems: "center",
    justifyContent: "center",
  }),
}

function Menubar({
  sx,
  ...props
}: Omit<MenubarPrimitive.Props, "className"> & { sx?: Sx }) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      {...props}
      {...styleProps(styles.root, sx)}
    />
  )
}

function MenubarMenu({ ...props }: React.ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu data-slot="menubar-menu" {...props} />
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup data-slot="menubar-group" {...props} />
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPortal>) {
  return <DropdownMenuPortal data-slot="menubar-portal" {...props} />
}

function MenubarTrigger({
  sx,
  ...props
}: Omit<React.ComponentProps<typeof DropdownMenuTrigger>, "className"> & {
  sx?: Sx
}) {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      {...props}
      {...styleProps(styles.trigger, sx)}
    />
  )
}

function MenubarContent({
  sx,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      submenu
      // The original's defaults: flush with the bar's inner edge, a little
      // further below it than a dropdown sits under its trigger.
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      {...props}
      sx={[styles.content, sx]}
    />
  )
}

function MenubarItem({
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem data-slot="menubar-item" {...props} />
}

function MenubarCheckboxItem({
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
      data-slot="menubar-checkbox-item"
      data-inset={inset}
      checked={checked}
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        styles.itemLeading,
        sx
      )}
    >
      <span sx={styles.indicator}>
        <MenuPrimitive.CheckboxItemIndicator>
          <Icon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />
}

function MenubarRadioItem({
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
      data-slot="menubar-radio-item"
      data-inset={inset}
      {...props}
      {...styleProps(
        ...menuItem({ variant: "default" }),
        styles.itemLeading,
        sx
      )}
    >
      <span sx={styles.indicator}>
        <MenuPrimitive.RadioItemIndicator>
          <Icon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function MenubarLabel({
  ...props
}: React.ComponentProps<typeof DropdownMenuLabel>) {
  return <DropdownMenuLabel data-slot="menubar-label" {...props} />
}

function MenubarSeparator({
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return <DropdownMenuSeparator data-slot="menubar-separator" {...props} />
}

function MenubarShortcut({
  ...props
}: React.ComponentProps<typeof DropdownMenuShortcut>) {
  return <DropdownMenuShortcut data-slot="menubar-shortcut" {...props} />
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub data-slot="menubar-sub" {...props} />
}

function MenubarSubTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger>) {
  return <DropdownMenuSubTrigger data-slot="menubar-sub-trigger" {...props} />
}

function MenubarSubContent({
  sx,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      data-slot="menubar-sub-content"
      {...props}
      sx={[styles.subContent, sx]}
    />
  )
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
}
