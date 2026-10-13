import { css, firstThatWorks, keyframes, media } from "@kirana-style/core"
import * as kirana from "@kirana-style/core"
import { brand } from "./tokens"

export const tall = firstThatWorks("100dvh", "100vh")
export const screen = css({ minHeight: tall, height: firstThatWorks("100svh", 100 + "vh") })
export const same = css({ minHeight: firstThatWorks("100dvh", "100vh") })
export const reversed = css({ minHeight: firstThatWorks("100vh", "100dvh") })
export const responsive = css({
  position: { base: "relative", [media("(min-width: 40rem)")]: firstThatWorks("sticky", "-webkit-sticky") },
})
export const shorthand = css({ padding: firstThatWorks("max(1rem, env(safe-area-inset-top))", "1rem") })
export const colour = css({ color: firstThatWorks(brand.ink, "#334") })
export const single = css({ display: firstThatWorks("grid") })
export const namespaced = css({ display: kirana.firstThatWorks("grid", "flex") })
export const fade = keyframes({ to: { opacity: firstThatWorks("0.1", "0") } })
export const badFrame = keyframes({ to: { padding: firstThatWorks("1px 2px", "var(--p)") } })
export const variable = css({ "--gap": firstThatWorks("1rem", "16px") })
export const empty = css({ display: firstThatWorks() })
export const nested = css({ display: firstThatWorks(firstThatWorks("grid", "flex"), "block") })
export const notCss = css({ display: firstThatWorks({ grid: true }, "block") })
export const mismatched = css({ padding: firstThatWorks("1rem 2rem", "var(--pad)") })
export const invalid = css({ width: firstThatWorks("10rem", 10) })
export function Dynamic({ value }: { value: string }) {
  return css({ minHeight: firstThatWorks(value, "100vh") })
}
