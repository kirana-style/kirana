/**
 * Semantic tokens. Every colour is one `light-dark(<light>, <dark>)` pair and the
 * mode is the root's `color-scheme`, set by ThemeProvider's `mode` handle. No
 * token is ever reassigned, so a derived token (`alpha`, `surface`) can read
 * these on `:root` and still follow the mode wherever it is used.
 */

import { defineTokens } from "@kirana-style/core"

/**
 * Paper and ink: warm neutrals (hue 70 to 85, chroma at most 0.014) rather than pure greys,
 * so the landscapes' cream walls and gold light sit in the page rather than on clinical white.
 * The colours are shown on the brand page (`/brand`, Colour); `bun
 * scripts/check-contrast.ts` in apps/docs fails when a text pair drops below WCAG AA.
 */
export const theme = defineTokens(
  "theme",
  {
    background: `light-dark(oklch(0.988 0.004 85), oklch(0.165 0.008 70))`,
    foreground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,

    card: `light-dark(oklch(0.997 0.002 85), oklch(0.2 0.009 70))`,
    cardForeground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,

    popover: `light-dark(oklch(0.997 0.002 85), oklch(0.2 0.009 70))`,
    popoverForeground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,

    primary: `light-dark(oklch(0.2 0.012 70), oklch(0.955 0.006 85))`,
    primaryForeground: `light-dark(oklch(0.988 0.004 85), oklch(0.2 0.012 70))`,

    secondary: `light-dark(oklch(0.962 0.007 85), oklch(0.25 0.01 70))`,
    secondaryForeground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,

    muted: `light-dark(oklch(0.962 0.007 85), oklch(0.25 0.01 70))`,
    mutedForeground: `light-dark(oklch(0.5 0.014 70), oklch(0.72 0.012 80))`,

    accent: `light-dark(oklch(0.962 0.007 85), oklch(0.25 0.01 70))`,
    accentForeground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,

    destructive: `light-dark(oklch(0.577 0.245 27.325), oklch(0.704 0.191 22.216))`,

    border: `light-dark(oklch(0.912 0.01 80), oklch(0.97 0.01 85 / 10%))`,
    input: `light-dark(oklch(0.9 0.01 80), oklch(0.97 0.01 85 / 15%))`,
    ring: `light-dark(oklch(0.68 0.012 75), oklch(0.56 0.01 75))`,

    chart1: "oklch(0.87 0 0)",
    chart2: "oklch(0.556 0 0)",
    chart3: "oklch(0.439 0 0)",
    chart4: "oklch(0.371 0 0)",
    chart5: "oklch(0.269 0 0)",

    sidebar: `light-dark(oklch(0.98 0.005 85), oklch(0.2 0.009 70))`,
    sidebarForeground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,
    sidebarPrimary: `light-dark(oklch(0.2 0.012 70), oklch(0.955 0.006 85))`,
    sidebarPrimaryForeground: `light-dark(oklch(0.988 0.004 85), oklch(0.2 0.012 70))`,
    sidebarAccent: `light-dark(oklch(0.962 0.007 85), oklch(0.25 0.01 70))`,
    sidebarAccentForeground: `light-dark(oklch(0.2 0.012 70), oklch(0.965 0.006 85))`,
    sidebarBorder: `light-dark(oklch(0.912 0.01 80), oklch(0.97 0.01 85 / 10%))`,
    sidebarRing: `light-dark(oklch(0.68 0.012 75), oklch(0.56 0.01 75))`,
  },
  { variable: true }
)

/**
 * The radius scale, derived from one 0.625rem base, so `lg` is 0.625rem rather
 * than Tailwind's 0.5rem. Variables, so a theme can restyle corner roundness.
 */
export const radius = defineTokens(
  "radius",
  {
    base: "0.625rem",
    sm: "calc(0.625rem * 0.6)",
    md: "calc(0.625rem * 0.8)",
    lg: "0.625rem",
    xl: "calc(0.625rem * 1.4)",
    "2xl": "calc(0.625rem * 1.8)",
    "3xl": "calc(0.625rem * 2.2)",
    "4xl": "calc(0.625rem * 2.6)",
    full: "calc(infinity * 1px)",
  },
  { variable: true }
)

/**
 * Translucent derivatives of the palette. Each is a `color-mix` over the base
 * variable, resolved where it is used, so it follows the mode too. Only the
 * combinations the components use are defined; a new opacity is a
 * design-system change, not an inline decision.
 */
export const alpha = defineTokens(
  "alpha",
  {
    background10: `color-mix(in oklab, ${theme.background} 10%, transparent)`,
    background20: `color-mix(in oklab, ${theme.background} 20%, transparent)`,

    foreground5: `color-mix(in oklab, ${theme.foreground} 5%, transparent)`,
    foreground10: `color-mix(in oklab, ${theme.foreground} 10%, transparent)`,
    foreground60: `color-mix(in oklab, ${theme.foreground} 60%, transparent)`,

    primary5: `color-mix(in oklab, ${theme.primary} 5%, transparent)`,
    primary10: `color-mix(in oklab, ${theme.primary} 10%, transparent)`,
    primary20: `color-mix(in oklab, ${theme.primary} 20%, transparent)`,
    primary30: `color-mix(in oklab, ${theme.primary} 30%, transparent)`,
    primary40: `color-mix(in oklab, ${theme.primary} 40%, transparent)`,
    primary80: `color-mix(in oklab, ${theme.primary} 80%, transparent)`,

    secondary80: `color-mix(in oklab, ${theme.secondary} 80%, transparent)`,

    muted50: `color-mix(in oklab, ${theme.muted} 50%, transparent)`,

    destructive10: `color-mix(in oklab, ${theme.destructive} 10%, transparent)`,
    destructive20: `color-mix(in oklab, ${theme.destructive} 20%, transparent)`,
    destructive30: `color-mix(in oklab, ${theme.destructive} 30%, transparent)`,
    destructive40: `color-mix(in oklab, ${theme.destructive} 40%, transparent)`,
    destructive50: `color-mix(in oklab, ${theme.destructive} 50%, transparent)`,
    destructive90: `color-mix(in oklab, ${theme.destructive} 90%, transparent)`,

    input20: `color-mix(in oklab, ${theme.input} 20%, transparent)`,
    input30: `color-mix(in oklab, ${theme.input} 30%, transparent)`,
    input50: `color-mix(in oklab, ${theme.input} 50%, transparent)`,
    input80: `color-mix(in oklab, ${theme.input} 80%, transparent)`,

    popover70: `color-mix(in oklab, ${theme.popover} 70%, transparent)`,

    border50: `color-mix(in oklab, ${theme.border} 50%, transparent)`,

    ring50: `color-mix(in oklab, ${theme.ring} 50%, transparent)`,

    sidebarForeground70: `color-mix(in oklab, ${theme.sidebarForeground} 70%, transparent)`,
  },
  { variable: true }
)

/**
 * Component-intent tokens, which is why there is no `dark:` variant: where light
 * and dark differ in structure (a control transparent in light but filled in
 * dark), the component names the intent (`surface.control`) and the decision
 * lives in one `light-dark()` value. The tokens that are not colours take
 * `{ light, dark }` mode values instead.
 */
export const surface = defineTokens(
  "surface",
  {
    /** Resting fill of an input, textarea, select or checkbox. */
    control: `light-dark(transparent, ${alpha.input30})`,
    /** Fill of that control once disabled. */
    controlDisabled: `light-dark(${alpha.input50}, ${alpha.input80})`,
    /** Fill of a control-like trigger on hover. */
    controlHover: `light-dark(${theme.muted}, ${alpha.input50})`,

    /** Border and ring of anything failing validation. */
    borderInvalid: `light-dark(${theme.destructive}, ${alpha.destructive50})`,
    ringInvalid: `light-dark(${alpha.destructive20}, ${alpha.destructive40})`,

    /**
     * The page behind a card-based layout: a muted wash in light mode, and the
     * plain background in dark, where a second grey would muddy the contrast.
     */
    page: `light-dark(${theme.muted}, ${theme.background})`,

    /** Hover fill for ghost-weight controls. */
    hover: `light-dark(${theme.muted}, ${alpha.muted50})`,

    /** The outline button: border, resting fill, hover fill. */
    outlineBorder: `light-dark(${theme.border}, ${theme.input})`,
    outlineBackground: `light-dark(${theme.background}, ${alpha.input30})`,
    outlineHover: `light-dark(${theme.muted}, ${alpha.input50})`,
    /** An outline button whose popup is open: `muted` in light; in dark it keeps the resting fill. */
    outlineExpanded: `light-dark(${theme.muted}, ${alpha.input30})`,

    /** Destructive controls, which are tinted rather than filled. */
    destructiveSoft: `light-dark(${alpha.destructive10}, ${alpha.destructive20})`,
    destructiveSoftHover: `light-dark(${alpha.destructive20}, ${alpha.destructive30})`,

    /**
     * The selected tab, or any segmented control's active segment. The border is
     * only drawn in dark mode, where the pill needs an edge against the list.
     */
    activeSurface: `light-dark(${theme.background}, ${alpha.input30})`,
    activeBorder: `light-dark(transparent, ${theme.input})`,
    /** An unselected tab: dimmed foreground in light, `muted-foreground` in dark. */
    inactiveForeground: `light-dark(${alpha.foreground60}, ${theme.mutedForeground})`,
  },
  { variable: true }
)
