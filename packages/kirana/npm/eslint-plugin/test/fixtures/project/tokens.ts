import { defineTokens } from "@kirana-style/core"

export const color = defineTokens("color", {
  brand: "#0af",
  ink: { light: "black", dark: "white" },
  blend: { light: "multiply", dark: "screen" },
  "x-y": "#123456",
  500: "#654321",
  empty: { value: "", syntax: "*" },
})
export const space = defineTokens("space", { 4: "1rem" })
const hidden = defineTokens("hidden", { a: "#999999" })
export { hidden }
