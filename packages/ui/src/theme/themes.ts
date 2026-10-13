/**
 * The three colour modes. `system` follows the operating system; `light` and
 * `dark` pin it. Every colour token is `light-dark(<light>, <dark>)` and the few
 * non-colour mode tokens (`surface.image*`) are mode tokens, so the mode handle
 * on `<html>` is the whole theme.
 */
export const THEME_MODES = ["system", "light", "dark"] as const

export type ThemeMode = (typeof THEME_MODES)[number]
