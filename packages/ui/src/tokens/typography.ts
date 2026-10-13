/**
 * Type scale and typefaces.
 *
 * Layer 1 (primitives). Plain constants: the compiler inlines them, so they
 * emit no CSS and the full Tailwind vocabulary costs nothing to carry here.
 * Only tokens that need to change per theme belong in `theme/semantic.ts`.
 */

/**
 * The typefaces, by name: the four variable fonts `globals.css` loads and the
 * system stacks. Each stack ends in a generic family, so glyphs a web font lacks
 * (emoji) still render. Components never use these directly: they use
 * `fontFamily`, which says what a face is for, so swapping a face is one line.
 */
export const typeface = {
  inter: '"Inter Variable", sans-serif',
  plusJakartaSans: '"Plus Jakarta Sans Variable", "Inter Variable", sans-serif',
  cormorantGaramond: '"Cormorant Garamond Variable", ui-serif, Georgia, serif',
  crimsonPro: '"Crimson Pro Variable", serif',
  jetbrainsMono:
    "\"JetBrains Mono Variable\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  systemSerif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  systemMono:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const

/**
 * What each face is for. Each role reads a named custom property and falls back to its typeface,
 * so nothing sets them in normal use and the page renders the fallback. The docs' font lab
 * (`?fonts`) sets them on the root element to try other faces without a rebuild.
 */
export const fontFamily = {
  /** Body text and interface labels. */
  sans: `var(--font-sans, ${typeface.inter})`,
  /** Titles and headings. */
  heading: `var(--font-heading, ${typeface.crimsonPro})`,
  /** A sans for display lines the heading serif sets badly, such as code-like words. */
  display: `var(--font-display, ${typeface.plusJakartaSans})`,
  /** Serif accents: the wordmark, quotations. */
  serif: `var(--font-serif, ${typeface.crimsonPro})`,
  /** Code, commands and class names. */
  mono: `var(--font-mono, ${typeface.jetbrainsMono})`,
  /** Measured figures: stats, prices, timings. Mono, so digits line up. */
  numeric: `var(--font-numeric, ${typeface.jetbrainsMono})`,
} as const

export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
  "7xl": "4.5rem",
  "8xl": "6rem",
  "9xl": "8rem",
} as const

/**
 * Line heights paired with each `fontSize` step, as unitless ratios so they scale
 * with the text the way Tailwind's `--text-*--line-height` do.
 *
 * Each ratio is stored **rounded up** at five decimals, not written as
 * `calc(1.25 / 0.875)`. The CSS minifier folds any such expression to five
 * decimals and rounds down: `1.42857` × 14px is 19.99998px, and Chrome lays text
 * out in 1/64px steps, so every small line became 19.984px. Across a long page
 * that drifted into a visible 1px shift against the Tailwind original, which
 * escapes the minifier by keeping the `calc` inside a custom property. Rounding
 * up lands every paired size on a whole pixel. The comment on each line keeps
 * Tailwind's original ratio.
 */
export const lineHeight = {
  xs: "1.33334", // 1 / 0.75
  sm: "1.42858", // 1.25 / 0.875
  base: "1.5", // 1.5 / 1
  lg: "1.55556", // 1.75 / 1.125
  xl: "1.4", // 1.75 / 1.25
  "2xl": "1.33334", // 2 / 1.5
  "3xl": "1.2", // 2.25 / 1.875
  "4xl": "1.11112", // 2.5 / 2.25
  "5xl": "1",
  "6xl": "1",
  "7xl": "1",
  "8xl": "1",
  "9xl": "1",
} as const

export const fontWeight = {
  thin: "100",
  extralight: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const

export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const

/** Standalone leading values, for when they are not tied to a font size. */
export const leading = {
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const
