import { css } from "@kirana-style/core"

// A part pads its sides, and a caller resets the whole box: `"*": null` on `padding` drops the
// part's `paddingInline` too, which would otherwise outrank the later `padding` (KF-064).
const content = css({ paddingInline: "16px", paddingBlock: "8px" })
const flush = css({ padding: { "*": null, base: "0" } })

export const merged = css(content, flush)

// `padding: null` is a whole removal too; so is `borderRadius`'s, for its logical corners.
export const nulled = css(content, css({ padding: null }))
export const corners = css(
  css({ borderStartStartRadius: "4px", borderEndEndRadius: "4px" }),
  css({ borderRadius: { "*": null, base: "0" } }),
)

// One side, or a removal under a condition, keeps to the property it names: which logical side
// `paddingLeft` is depends on the direction.
export const oneSide = css(content, css({ paddingLeft: { "*": null } }))
export const hovered = css(content, css({ padding: { ":hover": null } }))

export function Card({ wide }: { wide: boolean }) {
  return <div sx={[content, wide && flush]} />
}
