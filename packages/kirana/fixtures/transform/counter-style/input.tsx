import { counterStyle, css, firstThatWorks } from "@kirana-style/core"
import { marks } from "./tokens"
import { diamond } from "./shared"

export const check = counterStyle({ system: "cyclic", symbols: '"✓"', suffix: '" "' })
export const bracketed = counterStyle({ system: `extends ${check}`, prefix: '"("', suffix: '") "' })
export const stars = counterStyle({ system: "fixed", symbols: `${marks.star} "☆"`, fallback: check })
export const roman = counterStyle({ system: "additive", additiveSymbols: '10 "X", 5 "V", 1 "I"', range: "1 39" })
export const newer = counterStyle({ system: "brand-new-system" })
export const list = css({ listStyleType: bracketed })
export const item = css({ "::before": { content: `counter(item, ${stars}) " "` } })
export const shorthand = css({ listStyle: `${diamond} inside` })
export const numerals = css({ listStyleType: { base: roman, "@media (width >= 40rem)": newer } })
export const unused = counterStyle({ symbols: '"•"' })
export const unusedText = `${unused}`
export const notAnObject = counterStyle("cyclic")
export const computedKey = counterStyle({ [marks.ink]: '"x"' })
export const property = counterStyle({ color: "red" })
export const custom = counterStyle({ symbols: marks.ink })
export const noSymbols = counterStyle({ system: "cyclic" })
export const noFixedSymbols = counterStyle({ system: "fixed 3" })
export const noNumericSymbols = counterStyle({ system: "numeric", suffix: '"."' })
export const noAdditive = counterStyle({ system: "additive", symbols: '"x"' })
export const extendsWithSymbols = counterStyle({ system: `extends ${check}`, symbols: '"x"' })
export const empty = counterStyle({ symbols: " " })
export const notCss = counterStyle({ symbols: ['"a"'] })
export const reported = counterStyle({ symbols: firstThatWorks() })
export function Dynamic({ value }: { value: string }) {
  return counterStyle({ symbols: value })
}
