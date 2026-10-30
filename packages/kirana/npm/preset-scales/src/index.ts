/**
 * `@kirana-style/preset-scales`: scales with values compatible with Tailwind CSS v4 (KRN-TOK-009,
 * D-010). Data only: no semantic tokens, no component styles; unused tokens emit nothing. The utility
 * names for string `sx` are the preset, at `@kirana-style/preset-scales/preset`.
 *
 *   import { space, color } from "@kirana-style/preset-scales"
 *   css({ padding: space[4], color: color.blue[600] })
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
