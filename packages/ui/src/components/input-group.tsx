import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { groupedItem } from "../recipes/button-group"
import { recipe } from "../recipes/recipe"
import { Button } from "./button"
import { Input } from "./input"
import { Textarea } from "./textarea"
import { ctx } from "../theme/context"
import { inputGroupMarker, peer } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/** Inside a combobox popup the group must not draw its own focus ring. */

/** `rounded-[calc(var(--radius)-Npx)]`, for the controls tucked inside a group. */
const TIGHT_3 = `calc(${radius.base} - 3px)`

const styles = {
  root: css({
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,

    // Height and axis follow what the group actually contains: a textarea or a
    // stacked addon makes it grow, anything else keeps it one row tall.
    height: {
      base: spacing[8],
      ':has(> [data-align="block-end"])': "auto",
      ':has(> [data-align="block-start"])': "auto",
      ":has(> textarea)": "auto",
    },
    flexDirection: {
      base: "row",
      ':has(> [data-align="block-end"])': "column",
      ':has(> [data-align="block-start"])': "column",
    },

    // Padding handed down to the control. A stacked addon pads the far side of
    // the input, which is where the group's own edge now is: an addon above
    // (`block-start`) adds room below the text, and one below adds room above.
    [ctx.controlPaddingBlockStart]: {
      base: spacing[1],
      ':has(> [data-align="block-end"])': spacing[3],
    },
    [ctx.controlPaddingBlockEnd]: {
      base: spacing[1],
      ':has(> [data-align="block-start"])': spacing[3],
    },
    [ctx.controlPaddingInlineStart]: {
      base: spacing["2.5"],
      ':has(> [data-align="inline-start"])': spacing["1.5"],
    },
    [ctx.controlPaddingInlineEnd]: {
      base: spacing["2.5"],
      ':has(> [data-align="inline-end"])': spacing["1.5"],
    },

    backgroundColor: {
      base: surface.control,
      ":has(:disabled)": surface.controlDisabled,
    },
    opacity: { ":has(:disabled)": 0.5 },
    borderColor: {
      base: theme.input,
      // An invalid control keeps its error edge while focused.
      ':has([data-slot="input-group-control"]:focus-visible)': {
        base: theme.ring,
        ':has([data-slot][aria-invalid="true"])': theme.destructive,
      },
      // Full strength in both modes: only the ring softens in dark.
      ':has([data-slot][aria-invalid="true"])': theme.destructive,
      // Inside an open combobox the focused group keeps this ring, as in the
      // original; the StyleX port's inherited border there was its own.
    },
    boxShadow: {
      ':has([data-slot="input-group-control"]:focus-visible)': {
        base: `0 0 0 ${ring.width} ${alpha.ring50}`,
        ':has([data-slot][aria-invalid="true"])': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
      },
      ':has([data-slot][aria-invalid="true"])': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
  }),

  addonBase: css({
    display: "flex",
    height: "auto",
    cursor: "text",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
    userSelect: "none",
    [ctx.iconSize]: "1rem",
    opacity: {
      [inputGroupMarker.within('[data-disabled="true"]')]: 0.5,
    },
  }),
  inlineStart: css({
    order: -1,
    paddingInlineStart: spacing[2],
    // Pulls a nested button or key back so its own padding does not double up.
    marginInlineStart: {
      // A key beside a button pulls back by the key's amount.
      ":has(> button)": { base: "-0.3rem", ":has(> kbd)": "-0.15rem" },
      ":has(> kbd)": "-0.15rem",
    },
  }),
  inlineEnd: css({
    order: 1,
    paddingInlineEnd: spacing[2],
    marginInlineEnd: {
      // A key beside a button pulls back by the key's amount.
      ":has(> button)": { base: "-0.3rem", ":has(> kbd)": "-0.15rem" },
      ":has(> kbd)": "-0.15rem",
    },
  }),
  blockStart: css({
    order: -1,
    width: "100%",
    justifyContent: "flex-start",
    paddingInline: spacing["2.5"],
    paddingTop: spacing[2],
  }),
  blockEnd: css({
    order: 1,
    width: "100%",
    justifyContent: "flex-start",
    paddingInline: spacing["2.5"],
    paddingBottom: spacing[2],
  }),

  buttonBase: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    boxShadow: "none",
  }),
  buttonXs: css({
    height: spacing[6],
    gap: spacing[1],
    borderRadius: TIGHT_3,
    // Longhands: the Button's size sets start and end padding separately, and a
    // shorthand never beats a longhand.
    paddingInlineStart: spacing["1.5"],
    paddingInlineEnd: spacing["1.5"],
    [ctx.iconSize]: "0.875rem",
  }),
  buttonSm: css({}),
  buttonIconXs: css({
    width: spacing[6],
    height: spacing[6],
    borderRadius: TIGHT_3,
    // Logical longhands, not `padding: 0`: Button sets `paddingInline` plus
    // conditional `paddingInlineStart`/`End`, and a merge replaces entries of
    // the same longhand; `padding` would set the physical ones beside them.
    paddingTop: 0,
    paddingBottom: 0,
    paddingInlineStart: 0,
    paddingInlineEnd: 0,
  }),
  buttonIconSm: css({
    width: spacing[8],
    height: spacing[8],
    paddingTop: 0,
    paddingBottom: 0,
    paddingInlineStart: 0,
    paddingInlineEnd: 0,
  }),

  text: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
    [ctx.iconSize]: "1rem",
  }),

  /**
   * The control inside a group gives up its own chrome — the group draws the
   * border, background and focus ring for the whole assembly.
   */
  control: css({
    flex: 1,
    // `"*": null` drops every entry the Input brought for these properties —
    // its focus and invalid rings, and the corners and edges it joins a
    // ButtonGroup with — not only its base value. Inside a group the InputGroup
    // is the grouped item, never the input within it. Longhands, because the
    // Input sets longhands.
    borderStartStartRadius: { "*": null, base: 0 },
    borderStartEndRadius: { "*": null, base: 0 },
    borderEndStartRadius: { "*": null, base: 0 },
    borderEndEndRadius: { "*": null, base: 0 },
    borderTopWidth: { "*": null, base: 0 },
    borderBottomWidth: { "*": null, base: 0 },
    borderInlineStartWidth: { "*": null, base: 0 },
    borderInlineEndWidth: { "*": null, base: 0 },
    paddingTop: ctx.controlPaddingBlockStart,
    paddingBottom: ctx.controlPaddingBlockEnd,
    paddingInlineStart: ctx.controlPaddingInlineStart,
    paddingInlineEnd: ctx.controlPaddingInlineEnd,
    backgroundColor: { "*": null, base: "transparent" },
    boxShadow: { "*": null, base: "none" },
  }),
  // Longhands, to beat the control's own `paddingTop` / `paddingBottom`. A
  // textarea keeps its padding whatever addons surround it.
  controlTextarea: css({
    resize: "none",
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  }),
}

const inputGroupAddon = recipe({
  base: styles.addonBase,
  variants: {
    align: {
      "inline-start": styles.inlineStart,
      "inline-end": styles.inlineEnd,
      "block-start": styles.blockStart,
      "block-end": styles.blockEnd,
    },
  },
  defaults: { align: "inline-start" },
})

const inputGroupButton = recipe({
  base: styles.buttonBase,
  variants: {
    size: {
      xs: styles.buttonXs,
      sm: styles.buttonSm,
      "icon-xs": styles.buttonIconXs,
      "icon-sm": styles.buttonIconSm,
    },
  },
  defaults: { size: "xs" },
})

type El<T extends keyof React.JSX.IntrinsicElements = "div"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function InputGroup({ sx, ...props }: El) {
  return (
    <div
      data-slot="input-group"
      role="group"
      {...props}
      sx={[inputGroupMarker.anchor, groupedItem, styles.root, sx]}
    />
  )
}

function InputGroupAddon({
  sx,
  align = "inline-start",
  ...props
}: El & VariantProps<typeof inputGroupAddon>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) {
          return
        }
        event.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
      sx={[peer.anchor, ...inputGroupAddon({ align }), sx]}
    />
  )
}

function InputGroupButton({
  sx,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButton> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      {...props}
      sx={mergeSx(...inputGroupButton({ size }), sx)}
    />
  )
}

function InputGroupText({ sx, ...props }: El<"span">) {
  return <span data-slot="input-group-text" {...props} sx={[styles.text, sx]} />
}

function InputGroupInput({ sx, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      {...props}
      sx={mergeSx(styles.control, sx)}
    />
  )
}

function InputGroupTextarea({
  sx,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      data-slot="input-group-control"
      {...props}
      sx={mergeSx(styles.control, styles.controlTextarea, sx)}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
  inputGroupAddon as inputGroupAddonVariants,
  inputGroupButton as inputGroupButtonVariants,
}
