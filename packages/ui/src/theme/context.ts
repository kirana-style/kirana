/**
 * Contextual variables: a parent assigns one and the child reads it, so the
 * contract between them is a named token rather than a selector into markup
 * the parent does not own. The groups are `variable: true`, so a token used as
 * a key assigns its custom property:
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
    /** Size of an icon rendered inside a control. */
    iconSize: "1rem",

    /** Inner padding shared by the parts of a Card. */
    cardSpacing: "1rem",

    /** Gap a layout parent imposes on grouped children. */
    gap: "0px",

    /** Width override for a single Skeleton line. */
    skeletonWidth: "100%",

    /**
     * Padding an InputGroup imposes on the control inside it, so the text clears
     * whichever addons are present.
     */
    controlPaddingBlockStart: "0.25rem",
    controlPaddingBlockEnd: "0.25rem",
    controlPaddingInlineStart: "0.625rem",
    controlPaddingInlineEnd: "0.625rem",
  },
  { variable: true }
)

/**
 * The Toast stack's geometry on top of Base UI's `--toast-index`,
 * `--toast-height` and swipe offsets. Variables, because each toast computes its
 * transform from its own index and the formulas reference each other.
 */
export const toastCtx = defineTokens(
  "toastCtx",
  {
    /** Vertical space between stacked toasts. */
    gap: "0.75rem",
    /** How much of a toast behind the frontmost one peeks out. */
    peek: "0.75rem",
    /**
     * Inert placeholders: the real formulas read Base UI's variables, so they
     * are assigned on the toast in `toast.tsx`. A default is substituted on
     * `:root`, where those variables do not exist, and would poison the transform.
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
 * What a menu popup hands down to its rows: the solid surface (ContextMenu,
 * Menubar) and the glass one (DropdownMenu, Select, Combobox) highlight and
 * colour destructive rows differently.
 *
 * The defaults are inert on purpose: both surfaces in `recipes/menu.ts` assign
 * every value on the popup, where the theme's variables resolve. A default
 * naming a theme token would be substituted on `:root`, outside the themed
 * subtree, and come out in the light palette.
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
 * Sidebar geometry. Variables, so a caller can override them through the
 * provider's `sx` and the collapsed width can animate.
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
