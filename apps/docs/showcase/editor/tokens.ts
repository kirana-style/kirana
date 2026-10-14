import { defineTokens, media } from "@kirana-style/core"

export const space = defineTokens("space", { 4: "1rem", 6: "1.5rem" })
export const color = defineTokens("color", { brand: "#0af", ink: "#0a0a0a" })
export const md = media("(width >= 48rem)")
