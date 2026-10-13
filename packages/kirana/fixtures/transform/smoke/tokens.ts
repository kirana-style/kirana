import { defineTokens, media } from "@kirana-style/core"

export const space = defineTokens("space", { 2: "0.5rem", 4: "1rem" })
export const theme = defineTokens("theme", {
  fg: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  ring: { value: "oklch(0.7 0 0)", variable: true },
  blend: { light: "darken", dark: "lighten" },
})
export const md = media("(width >= 48rem)")
