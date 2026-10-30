import { css } from "@kirana-style/core"

// A component pads its box per breakpoint, and a caller clears both axes: together they hold the
// box's four sides, so the component's `padding` goes too and cannot outrank the caller at a wider
// screen (KF-076).
const empty = css({ padding: { base: "8px", "@media (width >= 48rem)": "24px" } })
const over = css({ paddingBlock: { "*": null, base: "4px" }, paddingInline: { "*": null, base: "4px" } })

export const A = () => <div sx={[empty, over]} />

// The four logical sides one by one, other boxes, and `null` for `"*": null`.
export const sides = css(
  css({ margin: "8px", inset: "0", borderWidth: "2px", width: "10rem", height: "4rem" }),
  css({
    marginInlineStart: null,
    marginInlineEnd: null,
    marginBlockStart: null,
    marginBlockEnd: null,
    insetBlock: { "*": null },
    insetInline: { "*": null },
    borderBlockWidth: null,
    borderInlineWidth: null,
    inlineSize: null,
    blockSize: { "*": null, base: "2rem" },
  }),
)

// The physical sides one by one take the logical ones likewise.
export const physical = css(
  css({ paddingInline: "16px", paddingBlock: "8px" }),
  css({ paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: { "*": null, base: "0" } }),
)

// One axis alone, or both under a condition, keeps to what it names: which physical sides an axis
// is depends on the writing mode.
export const oneAxis = css(empty, css({ paddingBlock: { "*": null, base: "4px" } }))
export const hovered = css(empty, css({ paddingBlock: { ":hover": null }, paddingInline: { ":hover": null } }))
