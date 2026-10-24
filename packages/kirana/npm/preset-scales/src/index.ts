/**
 * `@kirana-style/preset-scales`: the scale vocabulary this repository's design system proved, with
 * values compatible with Tailwind CSS v4 (KRN-TOK-009, D-010). Data only — no semantic tokens, no
 * component styles. Import what you use; unused tokens emit nothing.
 *
 *   import { space, color } from "@kirana-style/preset-scales"
 *   css({ padding: space[4], color: color.blue[600] })
 *
 * As a preset it also declares Tailwind v4's utility names over these scales, for string `sx`; the
 * preset lives at `@kirana-style/preset-scales/preset`, which a configuration file can import without
 * loading these tokens (`kirana.config.ts` runs uncompiled, where `defineTokens()` throws).
 */
export {
  blur,
  color,
  containerSize,
  duration,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  leading,
  letterSpacing,
  lineHeight,
  radius,
  screen,
  shadow,
  space,
  textShadow,
  zIndex,
} from "./scales.ts"
export { breakpoint, containerQuery } from "./conditions.ts"
export { animation } from "./animate.ts"
export { compose } from "./compose.ts"
export { spacing } from "./spacing.ts"
