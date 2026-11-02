// Only declares values, but its compile writes the declarations of its variables.
import { defineTokens } from "@kirana-style/core"

export const glow = defineTokens("glow", { soft: "1px", hard: "2px" }, { variable: true })
