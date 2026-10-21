import { css, defineTokens } from "@kirana-style/core"

const color = defineTokens("color", {
  accent: { value: "royalblue", variable: true },
  ink: { light: "black", dark: "white" },
})
const space = defineTokens("space", { 4: { value: "1rem", variable: true } })

// A variable token is checked through the value it declares; an inlined one, as its value.
export const wrong = css({ padding: color.accent, gap: color.ink })

export const fine = css({ color: color.ink, backgroundColor: color.accent, padding: space[4] })
