/**
 * Accents: one colour a subtree is tinted with — a docs tab, a homepage
 * section, a feature page.
 *
 * `accent.base` is a variable token. A wrapper assigns it (`sx={accents.blue}`)
 * and everything inside reads it. Shades are mixed where they are used, with
 * `tint()`, never in the token's default: a default resolves on `:root`, so a
 * shade written there would ignore the wrapper's colour.
 *
 * Every palette entry is a `light-dark()` pair (Tailwind's 600 for light
 * surfaces, 400 for dark ones), so an accent follows the colour scheme like
 * every other colour in this system.
 */
import { css, defineTokens } from "@kirana-style/core"
import type { StyleHandle } from "@kirana-style/core"

import { theme } from "@workspace/ui/theme/semantic"

export const accent = defineTokens(
  "accent",
  {
    base: theme.foreground,
    /** What is drawn on the accent (a keycap's glyph): white, or the page's background on neutral. */
    on: "white",
  },
  { variable: true }
)

/** `accent.base` mixed with transparency: `tint(12)` is a 12 % wash. */
export function tint(percent: number): string {
  return `color-mix(in oklab, ${accent.base} ${percent}%, transparent)`
}

export const PALETTE = {
  neutral: theme.foreground,
  blue: "light-dark(oklch(0.546 0.245 262.881), oklch(0.707 0.165 254.624))",
  violet: "light-dark(oklch(0.541 0.281 293.009), oklch(0.702 0.183 293.541))",
  amber: "light-dark(oklch(0.666 0.179 58.318), oklch(0.828 0.189 84.429))",
  pink: "light-dark(oklch(0.592 0.249 0.584), oklch(0.718 0.202 349.761))",
  sky: "light-dark(oklch(0.588 0.158 241.966), oklch(0.746 0.16 232.661))",
  emerald: "light-dark(oklch(0.596 0.145 163.225), oklch(0.765 0.177 163.223))",
  orange: "light-dark(oklch(0.646 0.222 41.116), oklch(0.75 0.183 55.934))",
} as const

export type AccentName = keyof typeof PALETTE

/** Assigns an accent to a subtree: `<section sx={accents.orange}>`. */
export const accents: Record<AccentName, StyleHandle> = {
  // Neutral is the foreground colour itself, white in dark mode: a glyph drawn on
  // it takes the background colour, or it disappears.
  neutral: css({
    [accent.base]: PALETTE.neutral,
    [accent.on]: theme.background,
  }),
  blue: css({ [accent.base]: PALETTE.blue, [accent.on]: "white" }),
  violet: css({ [accent.base]: PALETTE.violet, [accent.on]: "white" }),
  amber: css({ [accent.base]: PALETTE.amber, [accent.on]: "white" }),
  pink: css({ [accent.base]: PALETTE.pink, [accent.on]: "white" }),
  sky: css({ [accent.base]: PALETTE.sky, [accent.on]: "white" }),
  emerald: css({ [accent.base]: PALETTE.emerald, [accent.on]: "white" }),
  orange: css({ [accent.base]: PALETTE.orange, [accent.on]: "white" }),
}
