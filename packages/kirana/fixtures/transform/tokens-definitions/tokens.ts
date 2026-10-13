import { defineTokens } from "@kirana-style/core"

export const space = defineTokens("space", { 1: "0.25rem", 1.5: "0.375rem", px: "1px" })
export const palette = defineTokens("palette", { blue: "oklch(0.6 0.2 260)", white: "oklch(1 0 0)" })
export const theme = defineTokens("theme", {
  fg: { light: palette.blue, dark: palette.white },
  blend: { light: "darken", dark: "lighten" },
  ring: { value: "oklch(0.7 0 0)", variable: true },
  accent: palette.blue,
  mix: `color-mix(in oklab, ${palette.blue} 50%, transparent)`,
  nested: { level: { deep: "1px" } },
  count: 3,
})
export const ctx = defineTokens("ctx", { gap: "0px", icon: { light: "1rem", dark: "1rem" } }, { variable: true })
