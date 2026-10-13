import { css, firstThatWorks, keyframes, media, select, viewTransition } from "@kirana-style/core"
import { brand } from "./tokens"

const fadeOut = keyframes({ to: { opacity: 0 } })
const slideIn = keyframes({ from: { translate: "0 1rem" } })

export const card = css({ borderRadius: "8px" })
export const slide = viewTransition({
  new: { animationName: slideIn, animationDuration: { base: "250ms", [media("(prefers-reduced-motion: reduce)")]: "0s" } },
  old: { animationName: fadeOut, animationDuration: "150ms" },
  group: {
    animationTimingFunction: firstThatWorks("linear(0, 1.2 60%, 1)", "ease-out"),
    animationDuration: { "@supports (animation-timeline: view())": "300ms" },
  },
  imagePair: { isolation: "auto" },
})
export const combined = css(card, slide)
export const Item = () => <li sx={[card, slide]} style={{ viewTransitionName: "item-1" }} />
export const name: string = slide
export const plain = viewTransition({})
export const unknownPart = viewTransition({ wrapper: { opacity: 1 } })
export const hover = viewTransition({ old: { opacity: { ":hover": 1 } } })
export const notAnObject = viewTransition("slide")
export const computedKey = viewTransition({ old: { [brand.ink]: "red" } })
export const selectKey = viewTransition({ old: { opacity: { [select.child("svg")]: 1 } } })
export const partNotObject = viewTransition({ old: "fade" })
export const badDeclaration = viewTransition({ new: { animationDurationn: "1s" } })
export function Dynamic({ value }: { value: string }) {
  return viewTransition({ old: { animationDuration: value } })
}
