import { defineTokens } from "@kirana-style/core"

export const space = defineTokens("space", { "1": "0.25rem", "4": "1rem" })
export const size = defineTokens("size", { sm: "0.875rem", xs: "0.75rem" })
export const leading = defineTokens("leading", { sm: "1.25" })
export const color = defineTokens("color", {
  blue: { "600": "oklch(54.6% 0.245 262.881)" },
  white: "#fff",
})
export const ease = defineTokens("ease", { inOut: "cubic-bezier(0.4, 0, 0.2, 1)" })
