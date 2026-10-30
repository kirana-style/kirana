import { defineTokens } from "@kirana-style/core"

export const space = defineTokens("space", { "0.5": "0.125rem", "1": "0.25rem", "2": "0.5rem", "4": "1rem" })
export const color = defineTokens("color", {
  blue: { "600": "oklch(54.6% 0.245 262.881)" },
  white: "#fff",
})
export const radius = defineTokens("radius", { lg: { value: "0.5rem", syntax: "<length>" } })
export const fontSize = defineTokens("fontSize", { sm: "0.875rem" })
export const lineHeight = defineTokens("lineHeight", { sm: "1.25rem" })
const layer = (value: string) => ({ value, syntax: "*", inherits: false })
export const compose = defineTokens("compose", {
  shadow: layer("0 0 #0000"),
  "ring-shadow": layer("0 0 #0000"),
  "ring-width": layer("0px"),
  "ring-color": layer("currentcolor"),
  "border-style": layer("solid"),
  "translate-x": layer("0"),
  "translate-y": layer("0"),
  blur: { syntax: "*", inherits: false },
  grayscale: { syntax: "*", inherits: false },
})
