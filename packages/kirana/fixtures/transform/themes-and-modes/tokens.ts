import { defineTokens } from "@kirana-style/core"
export const theme = defineTokens(
  "theme",
  { primary: "oklch(0.6 0.2 260)", blend: { light: "darken", dark: "lighten" }, group: { inner: "1px" } },
  { variable: true },
)
export const fixed = defineTokens("fixed", { size: "1px" })
