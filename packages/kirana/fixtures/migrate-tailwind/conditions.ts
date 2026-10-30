import { media, relation } from "@kirana-style/core"

const ui = relation("ui")

export const breakpoint = { lg: media("(width >= 64rem)") }
export const DARK = "@media (prefers-color-scheme: dark)"
export const AFTER = "::after"
export const mode = { dark: ui.within('[data-mode="dark"]') }
export const NOT_A_CONDITION = 4
