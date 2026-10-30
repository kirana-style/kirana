/**
 * Accents: the one colour a subtree is tinted with (a page, a docs tab, a homepage door). A
 * wrapper assigns the variable token `accent.base` (`sx={accents.forest}`) and everything inside
 * reads it. Shades are mixed where they are used, with `tint()`: a default resolves on `:root`, so
 * a shade written there would ignore the wrapper. Each hue is a `light-dark()` pair readable as
 * text in both schemes (`scripts/check-contrast.ts` in apps/docs measures them); which page wears
 * which is `apps/docs/src/brand/scenes.ts`.
 */
import { css, defineTokens } from "@kirana-style/core"
import type { StyleHandle } from "@kirana-style/core"

import { theme } from "@workspace/ui/theme/semantic"

export const accent = defineTokens(
  "accent",
  {
    base: theme.foreground,
    /**
     * What is drawn on the accent (a keycap's glyph). The background colour: paper on the deep
     * hues of the light scheme, night on the light hues of the dark one.
     */
    on: theme.background,
  },
  { variable: true }
)

/** `accent.base` mixed with transparency: `tint(12)` is a 12 % wash. */
export function tint(percent: number): string {
  return `color-mix(in oklab, ${accent.base} ${percent}%, transparent)`
}

export const PALETTE = {
  /** No hue: the ink itself. */
  neutral: theme.foreground,
  /** Forest on the ridges, the master scene. */
  forest: "light-dark(oklch(0.5 0.1 150), oklch(0.8 0.11 150))",
  /** Tea rows and grass in the morning. */
  tea: "light-dark(oklch(0.5 0.11 128), oklch(0.83 0.13 128))",
  /** The pale sulphur water of a crater. */
  crater: "light-dark(oklch(0.5 0.09 185), oklch(0.82 0.1 185))",
  /** A lake under a clear sky. */
  lake: "light-dark(oklch(0.5 0.12 245), oklch(0.78 0.1 245))",
  /** Clay roof tiles. */
  terracotta: "light-dark(oklch(0.53 0.15 42), oklch(0.78 0.12 45))",
  /** Lime-washed walls in evening light, and ripe fields. */
  ochre: "light-dark(oklch(0.52 0.11 68), oklch(0.82 0.12 80))",
  /** The sky over a city after sunset. */
  dusk: "light-dark(oklch(0.5 0.15 290), oklch(0.78 0.11 290))",
} as const

export type AccentName = keyof typeof PALETTE

/**
 * The sun: the gold light every landscape shares, the brand's one constant accent. A fill only,
 * never text: the light sweeping through a scene's pixels, a live wire's spark, text selection.
 */
export const SUN = {
  sun: "light-dark(oklch(0.82 0.15 80), oklch(0.84 0.14 82))",
} as const

/** Assigns an accent to a subtree: `<section sx={accents.terracotta}>`. */
export const accents: Record<AccentName, StyleHandle> = {
  neutral: css({
    [accent.base]: PALETTE.neutral,
    [accent.on]: theme.background,
  }),
  forest: css({ [accent.base]: PALETTE.forest, [accent.on]: theme.background }),
  tea: css({ [accent.base]: PALETTE.tea, [accent.on]: theme.background }),
  crater: css({ [accent.base]: PALETTE.crater, [accent.on]: theme.background }),
  lake: css({ [accent.base]: PALETTE.lake, [accent.on]: theme.background }),
  terracotta: css({
    [accent.base]: PALETTE.terracotta,
    [accent.on]: theme.background,
  }),
  ochre: css({ [accent.base]: PALETTE.ochre, [accent.on]: theme.background }),
  dusk: css({ [accent.base]: PALETTE.dusk, [accent.on]: theme.background }),
}
