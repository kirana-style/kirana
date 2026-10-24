import { css } from "@kirana-style/core"

// Reported: an inline inset beside a translate that moves along x.
export const dialog = css({ position: "fixed", insetInlineStart: "50%", translate: "-50% -50%" })
export const rail = css({ insetInlineEnd: "-1rem", transform: "translateX(-50%)" })
export const both = css({ insetInline: "0", transform: "rotate(45deg) translate3d(10px, 0, 0)" })

// Not reported: no inline component, a physical inset, a translate per direction.
export const vertical = css({ insetInlineStart: "0", translate: "0 -50%", transform: "translate(0, 4px)" })
export const physical = css({ left: "50%", translate: "-50% -50%" })
export const directed = css({
  insetInlineStart: "50%",
  translate: { base: "-50% 0", ":dir(rtl)": "50% 0" },
})
export const none = css({ insetInlineStart: "50%", translate: "none", transform: "scale(2)" })
export const attributed = css({
  insetInlineEnd: 0,
  translate: { base: "50% 0", '[dir="rtl"]': "-50% 0" },
})
// Reported: a breakpoint is not a direction.
export const responsive = css({
  insetInlineStart: "50%",
  translate: { base: "-50% 0", "@media (width >= 40rem)": "-50% -50%" },
})
// Not reported: a translate read from a custom property, set at runtime (a swipe).
export const swiped = css({ insetInlineEnd: 0, transform: "translate3d(var(--swipe-x), 0, 0)" })
