/**
 * Layer 3: contextual variables.
 *
 * Tailwind patterns like `[&_svg:not([class*='size-'])]:size-4` reach into
 * markup a component does not own. Here a parent assigns one of these
 * variables, and the child reads it (`select.descendant` exists for the rare
 * case with no child component to read a value).
 *
 * The contract between parent and child is a named token rather than a
 * selector. The groups are `variable: true`, so a token used as a key assigns
 * its custom property:
 *
 *   // parent recipe
 *   { [ctx.iconSize]: "0.875rem" }
 *
 *   // the Icon primitive
 *   { width: ctx.iconSize, height: ctx.iconSize }
 */

import { defineTokens } from "@kirana-style/core"

export const ctx = defineTokens(
  "ctx",
  {
    /**
     * Size of an icon rendered inside a control. Replaces the `[&_svg]:size-4`
     * family; every recipe that contained one now sets this instead.
     */
    iconSize: "1rem",

    /** Inner padding shared by the parts of a Card. Was `--card-spacing`. */
    cardSpacing: "1rem",

    /**
     * Gap a layout parent imposes on grouped children. Was `--gap`; the blocks
     * canvas sets it once and every column and nested grid reads it.
     */
    gap: "0px",

    /** Width override for a single Skeleton line. Was `--skeleton-width`. */
    skeletonWidth: "100%",

    /**
     * Padding an InputGroup imposes on the control inside it, so the text clears
     * whichever addons are present.
     *
     * Was four `has-[>[data-align=…]]:[&>input]:p…` rules that reached from the
     * group into its input. The group declares the value and the control reads
     * it.
     */
    controlPaddingBlockStart: "0.25rem",
    controlPaddingBlockEnd: "0.25rem",
    controlPaddingInlineStart: "0.625rem",
    controlPaddingInlineEnd: "0.625rem",
  },
  { variable: true }
)

/**
 * The Toast stack's own geometry.
 *
 * Base UI supplies `--toast-index`, `--toast-height`, `--toast-offset-y` and the
 * swipe offsets; these are the values our design owns on top of them. They have
 * to be real variables rather than constants because each toast computes its
 * transform from its own index, and the formulas reference each other.
 */
export const toastCtx = defineTokens(
  "toastCtx",
  {
    /** Vertical space between stacked toasts. */
    gap: "0.75rem",
    /** How much of a toast behind the frontmost one peeks out. */
    peek: "0.75rem",
    /**
     * Inert placeholders. Each of these is composed from a variable Base UI writes
     * onto the toast, so the real formula is assigned in `toast.tsx`: a
     * token default is substituted on `:root`, where `--toast-index` and
     * friends do not exist, and the invalid result would poison the transform.
     */
    /** Height the stack animates against: the frontmost toast's height. */
    height: "auto",
    /** Scale applied to toasts further back in the stack. */
    scale: "1",
    /** How much that scaling shrank the toast, used to close the visual gap. */
    shrink: "0",
    /** Resting vertical offset once the stack is expanded. */
    offsetY: "0px",
  },
  { variable: true }
)

/**
 * What a menu popup hands down to its rows.
 *
 * Menus come in two surfaces. The solid one (ContextMenu, Menubar) highlights a
 * row with `accent` and paints destructive rows red. The glass one
 * (DropdownMenu, Select, Combobox) sits over a blurred backdrop, so it
 * highlights with a translucent `foreground/10` and keeps destructive rows in
 * the normal text colour. Tailwind expressed the difference from the popup with
 * `**:data-[slot$=-item]:focus:bg-foreground/10` and friends; here the popup
 * sets these variables and every row reads them.
 *
 * The defaults are inert on purpose: both surfaces in `recipes/menu.ts` assign
 * every value on the popup element, where the theme's own variables resolve. A
 * default naming a theme token would be substituted on `:root`, outside the
 * themed subtree, and come out in the light palette.
 */
export const menuCtx = defineTokens(
  "menuCtx",
  {
    highlight: "transparent",
    destructiveColor: "currentColor",
    destructiveHighlight: "transparent",
    separator: "transparent",
  },
  { variable: true }
)

/**
 * The Drawer's gesture and stacking geometry.
 *
 * Base UI supplies the live gesture values — `--drawer-swipe-progress`,
 * `--drawer-swipe-movement-x/y`, `--nested-drawers`, `--drawer-height` — and
 * these compose them into the transforms the drawer actually animates.
 *
 * The values below are inert placeholders on purpose. A token default is
 * emitted on `:root` and substituted there, so a default that reads
 * `var(--nested-drawers)` — which Base UI sets on the drawer, far below — is
 * invalid at the point it is declared, and an invalid custom property poisons
 * every value composed from it. The real formulas are assigned in `drawer.tsx`,
 * on the element where the library's variables actually exist.
 */

export const drawerCtx = defineTokens(
  "drawerCtx",
  {
    /** Solid extension past the drawer's edge, so an over-drag shows no gap. */
    bleed: "3rem",
    peek: "1rem",

    /** Height the stack animates against: the frontmost drawer's height. */
    stackHeight: "0px",
    stackScale: "1",
    /** How much the scaling shrank the drawer, used to keep its edge anchored. */
    stackShrink: "0",
    /** Offset that reveals the drawers stacked behind this one. */
    stackPeekOffset: "0px",

    /** Resolved translation, composed per swipe direction. */
    translateX: "0px",
    translateY: "0px",
    /** Where the drawer sits when closed, per swipe direction. */
    closedTransform: "none",

    contentHeight: "var(--drawer-height, auto)",
    contentMaxHeight: "none",
    contentWidth: "auto",
  },
  { variable: true }
)

/**
 * Sidebar geometry.
 *
 * These are variables rather than constants because the provider lets a caller
 * override them per app, and because the collapsed width has to animate.
 */
export const sidebarCtx = defineTokens(
  "sidebarCtx",
  {
    width: "16rem",
    widthIcon: "3rem",
    widthMobile: "18rem",
  },
  { variable: true }
)

/** Calendar cell geometry, shared by every part of the grid. */
export const calendarCtx = defineTokens(
  "calendarCtx",
  {
    cellSize: "1.75rem",
    cellRadius: "calc(0.625rem * 0.8)",
  },
  { variable: true }
)
