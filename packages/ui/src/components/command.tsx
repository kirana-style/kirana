import { css, props as styleProps } from "@kirana-style/core"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon, Tick02Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { InputGroup, InputGroupAddon } from "./input-group"
import { Icon } from "../primitives/icon"
import { visuallyHidden } from "../primitives/visually-hidden"
import { ctx } from "../theme/context"
import {
  commandItemMarker,
  commandShortcutMarker,
  dialogContentMarker,
} from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import {
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "../tokens/typography"

const styles = {
  root: css({
    display: "flex",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.popover,
    padding: spacing[1],
    color: theme.popoverForeground,
  }),
  /** The palette sits a third of the way down rather than dead centre. */
  dialog: css({
    top: "calc(100% / 3)",
    translate: "-50% 0",
    overflow: "hidden",
    borderRadius: radius.xl,
    padding: 0,
  }),

  inputWrapper: css({ padding: spacing[1], paddingBottom: 0 }),
  inputGroup: css({
    height: spacing[8],
    borderRadius: radius.lg,
    borderColor: alpha.input30,
    backgroundColor: alpha.input30,
    boxShadow: "none",
  }),
  input: css({
    width: "100%",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    /**
     * Not an `input-group-control`, so it does not read the group's context
     * padding. The search addon here is always inline-start, so the value is
     * constant.
     */
    paddingInlineStart: spacing["1.5"],
    cursor: { ":disabled": "not-allowed" },
    opacity: { ":disabled": 0.5 },
  }),
  searchIcon: css({ flexShrink: 0, opacity: 0.5 }),

  list: css({
    maxHeight: spacing[72],
    scrollPaddingBlock: spacing[1],
    overflowX: "hidden",
    overflowY: "auto",
    outlineStyle: "none",
    scrollbarWidth: "none",
    "::-webkit-scrollbar": { display: "none" },
  }),
  empty: css({
    paddingBlock: spacing[6],
    textAlign: "center",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),

  group: css({
    overflow: "hidden",
    padding: spacing[1],
    color: theme.foreground,
  }),
  /**
   * cmdk renders its group heading itself, so the heading is reached by its own
   * `[cmdk-group-heading]` attribute rather than by a descendant selector. This
   * is the one place a raw attribute key has to match an element we do not own.
   */
  groupHeading: css({
    // Block, not the span's default inline: vertical padding on an inline box
    // does not grow the line, so the heading would lose 8px of height.
    display: "block",
    paddingInline: spacing[2],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
  }),

  separator: css({
    marginInline: `calc(${spacing[1]} * -1)`,
    height: "1px",
    backgroundColor: theme.border,
  }),

  item: css({
    position: "relative",
    display: "flex",
    cursor: "default",
    alignItems: "center",
    gap: spacing[2],
    // Rows round off more inside the command palette than they do in an
    // inline command list.
    borderRadius: {
      base: radius.sm,
      [dialogContentMarker.within('[data-slot="dialog-content"]')]: radius.lg,
    },
    paddingInline: spacing[2],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    userSelect: "none",
    [ctx.iconSize]: "1rem",
    /**
     * `[data-selected="true"]`, never bare `[data-selected]`. cmdk writes the
     * attribute on every row as `"true"` or `"false"`, so a presence selector
     * highlights the whole list. Base UI adds and removes its attributes, so
     * presence selectors are right there.
     */
    backgroundColor: { '[data-selected="true"]': theme.muted },
    color: { '[data-selected="true"]': theme.foreground },
    pointerEvents: { '[data-disabled="true"]': "none" },
    opacity: { '[data-disabled="true"]': 0.5 },
  }),
  itemCheck: css({
    marginInlineStart: "auto",
    opacity: {
      base: 0,
      [commandItemMarker.within('[data-checked="true"]')]: 1,
    },
    /**
     * Hidden when the row shows a shortcut. Asked from the icon, which is always
     * rendered last, that is "does a shortcut come before me": a sibling query.
     * A visible check would share `margin-inline-start: auto` with the shortcut
     * and pull it mid-row.
     */
    display: {
      [commandShortcutMarker.after('[data-slot="command-shortcut"]')]: "none",
    },
  }),

  shortcut: css({
    marginInlineStart: "auto",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    letterSpacing: letterSpacing.widest,
    color: {
      base: theme.mutedForeground,
      [commandItemMarker.within('[data-selected="true"]')]: theme.foreground,
    },
  }),
}

function Command({
  sx,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive>, "className"> & {
  sx?: Sx
}) {
  return (
    <CommandPrimitive
      data-slot="command"
      {...props}
      {...styleProps(styles.root, sx)}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  sx,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  showCloseButton?: boolean
  children: React.ReactNode
  sx?: Sx
}) {
  return (
    <Dialog {...props}>
      <DialogHeader sx={visuallyHidden}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        showCloseButton={showCloseButton}
        sx={mergeSx(styles.dialog, sx)}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  sx,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Input>, "className"> & {
  sx?: Sx
}) {
  return (
    <div data-slot="command-input-wrapper" sx={styles.inputWrapper}>
      <InputGroup sx={styles.inputGroup}>
        <CommandPrimitive.Input
          data-slot="command-input"
          {...props}
          {...styleProps(styles.input, sx)}
        />
        <InputGroupAddon>
          <Icon icon={SearchIcon} strokeWidth={2} sx={styles.searchIcon} />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({
  sx,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.List>, "className"> & {
  sx?: Sx
}) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      {...props}
      {...styleProps(styles.list, sx)}
    />
  )
}

function CommandEmpty({
  sx,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Empty>, "className"> & {
  sx?: Sx
}) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      {...props}
      {...styleProps(styles.empty, sx)}
    />
  )
}

function CommandGroup({
  sx,
  heading,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Group>, "className"> & {
  sx?: Sx
}) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      heading={
        heading != null ? (
          <span sx={styles.groupHeading}>{heading}</span>
        ) : undefined
      }
      {...props}
      {...styleProps(styles.group, sx)}
    />
  )
}

function CommandSeparator({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof CommandPrimitive.Separator>,
  "className"
> & {
  sx?: Sx
}) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      {...props}
      {...styleProps(styles.separator, sx)}
    />
  )
}

function CommandItem({
  sx,
  children,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Item>, "className"> & {
  sx?: Sx
}) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      {...props}
      {...styleProps(commandItemMarker.anchor, styles.item, sx)}
    >
      {children}
      <Icon icon={Tick02Icon} strokeWidth={2} sx={styles.itemCheck} />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  sx,
  ...props
}: Omit<React.ComponentProps<"span">, "className"> & { sx?: Sx }) {
  return (
    <span
      data-slot="command-shortcut"
      {...props}
      sx={[commandShortcutMarker.anchor, styles.shortcut, sx]}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
