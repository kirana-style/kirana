import { css, firstThatWorks, positionTry } from "@kirana-style/core"
import { brand } from "./tokens"
import { above } from "./shared"

export const below = positionTry({ positionArea: "bottom span-right", marginTop: "4px", width: "anchor-size(width)" })
export const wide = positionTry({ inset: "auto", maxInlineSize: firstThatWorks("calc(100vw - 2rem)", "90vw") })
export const popover = css({
  positionAnchor: "--trigger",
  positionArea: "top",
  positionTryFallbacks: `${below}, ${above}, flip-block`,
})
export const single = css({ positionTryFallbacks: wide })
export const unused = positionTry({ alignSelf: "end" })
export const unusedText = `${unused}`
export const colour = positionTry({ color: brand.ink })
export const notAnObject = positionTry("bottom")
export const computedKey = positionTry({ [brand.ink]: "1px" })
export const unknown = positionTry({ marginTopp: "1px" })
export const badValue = positionTry({ top: { base: "0" } })
export function Dynamic({ value }: { value: string }) {
  return positionTry({ top: value })
}
