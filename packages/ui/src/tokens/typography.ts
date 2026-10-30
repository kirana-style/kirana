/**
 * Type scale and typefaces.
 *
 * Layer 1 (primitives). Plain constants: the compiler inlines them, so they
 * emit no CSS and the full Tailwind vocabulary costs nothing to carry here.
 * Only tokens that need to change per theme belong in `theme/semantic.ts`.
 */

/**
 * The typefaces, by name: the variable fonts `globals.css` loads and the system stacks.
 * Each stack ends in a generic family, so glyphs a web font lacks (emoji) still render.
 * Components never use these directly: they use `fontFamily`, which says what a face is for, so
 * swapping a face is one line. Why these: the brand page (`/brand`, Type).
 */
export const typeface = {
  /** EB Garamond, Georg Duffner and Octavio Pardo: an old-style serif with a drawn italic. */
  ebGaramond: '"EB Garamond Variable", ui-serif, Georgia, serif',
  /**
   * Crimson Pro, Jacques Le Bailly: the wordmark's italic. EB Garamond's italic r opens wide enough
   * to read as a v at the wordmark's size; Crimson Pro's does not.
   */
  crimsonPro: '"Crimson Pro Variable", ui-serif, Georgia, serif',
  /** Plus Jakarta Sans, Tokotype: the text and interface face. */
  plusJakartaSans:
    '"Plus Jakarta Sans Variable", ui-sans-serif, system-ui, sans-serif',
  jetbrainsMono:
    "\"JetBrains Mono Variable\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  systemSerif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  systemMono:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const

/**
 * What each face is for. Each role reads a named custom property and falls back to its typeface,
 * so nothing sets them in normal use and the page renders the fallback. The docs' font lab sets
 * them on the root element to try other faces without a rebuild.
 *
 * The serif is for display only: headings from 1.5rem up and the wordmark. Card titles, table
 * headers, labels and figures are set in the sans, where a small serif reads cramped.
 */
export const fontFamily = {
  /** Body text and interface labels. */
  sans: `var(--font-sans, ${typeface.plusJakartaSans})`,
  /** Display lines and headings from 1.5rem up. */
  heading: `var(--font-heading, ${typeface.ebGaramond})`,
  /** The wordmark: the name, set in Crimson Pro's italic. */
  serif: `var(--font-serif, ${typeface.crimsonPro})`,
  /** Code, commands, class names and chapter labels. */
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
 * Line heights paired with each `fontSize` step, as unitless ratios stored
 * rounded up at five decimals rather than as `calc(1.25 / 0.875)`. The minifier
 * folds such a `calc` and rounds down (1.42857 × 14px is 19.99998px, which Chrome
 * lays out at 19.984px), and over a long page the drift shows as a 1px shift.
 * Rounding up lands every paired size on a whole pixel. Each line's comment is
 * the exact ratio.
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

/**
 * The site's type roles. Each role is a size, the line height it is set with and its tracking,
 * looked up by the same key in all three maps: `textSize.title` with `textLeading.title` and
 * `textTracking.title`. Pages use these instead of one-off sizes, so a role changes in one place.
 *
 * Display roles are fluid between a phone and a wide screen. The serif roles (display1, display2,
 * title, heading) are tracked in a little, as a serif set large reads loose.
 */
export const textSize = {
  /** The homepage headline. */
  display1: "clamp(2.75rem, 1.55rem + 4.8vw, 5.25rem)",
  /** A page's headline. */
  display2: "clamp(2.375rem, 1.6rem + 3.1vw, 4rem)",
  /** A section's title. */
  title: "clamp(1.875rem, 1.45rem + 1.7vw, 2.75rem)",
  /** A docs H2, a closing line. */
  heading: "1.75rem",
  /** A card title, a docs H3 (sans). */
  subheading: "1.0625rem",
  /** The paragraph under a headline. */
  lede: "clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)",
  /** Interface text. */
  body: "1rem",
  /** Long-form reading text in the docs. */
  prose: "1rem",
  small: "0.875rem",
  caption: "0.8125rem",
  /** Chapter labels and table headers (mono, uppercase). */
  label: "0.6875rem",
  /** Labels inside figures and drawn windows. */
  micro: "0.625rem",
} as const

export const textLeading = {
  display1: "1",
  display2: "1.04",
  title: "1.08",
  heading: "1.2",
  subheading: "1.4",
  lede: "1.6",
  body: "1.5",
  prose: "1.75",
  small: "1.6",
  caption: "1.55",
  label: "1.45",
  micro: "1.4",
} as const

export const textTracking = {
  display1: "-0.024em",
  display2: "-0.02em",
  title: "-0.015em",
  heading: "-0.01em",
  subheading: "-0.005em",
  lede: "0em",
  body: "0em",
  prose: "0em",
  small: "0em",
  caption: "0em",
  label: "0.04em",
  micro: "0.02em",
} as const
