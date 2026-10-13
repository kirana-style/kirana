import { defineTokens } from "@kirana-style/core"

export const theme = defineTokens(
  "theme",
  {
    primary: "light-dark(oklch(0.2 0 0), oklch(0.9 0 0))",
    "primary-foreground": "light-dark(oklch(0.98 0 0), oklch(0.2 0 0))",
    muted: "light-dark(oklch(0.97 0 0), oklch(0.27 0 0))",
    "muted-foreground": "light-dark(oklch(0.55 0 0), oklch(0.7 0 0))",
    ring: "light-dark(oklch(0.7 0 0), oklch(0.55 0 0))",
    destructive: "light-dark(oklch(0.58 0.22 27), oklch(0.7 0.19 22))",
    border: "light-dark(oklch(0.92 0 0), oklch(1 0 0 / 10%))",
  },
  { variable: true }
)
