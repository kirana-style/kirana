import { container, media, relation } from "@kirana-style/core"

const ui = relation("ui")

export const breakpoint = { lg: media("(width >= 64rem)") }
export const containerQuery = { md: container("(width >= 28rem)") }
export const DARK = "@media (prefers-color-scheme: dark)"
export const mode = { dark: ui.within('[data-mode="dark"]') }
