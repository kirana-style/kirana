import { defineTokens } from "@kirana-style/core"

export const fade = defineTokens("fade", {
  // Registered: animatable, emitted as @property with no :root declaration.
  size: { value: "0px", syntax: "<length-percentage>", inherits: false },
  angle: { value: "0deg", syntax: " <angle> " },
})
export const plain = defineTokens("plain", { gap: "1rem" })
