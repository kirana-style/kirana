/**
 * Durations and easing curves.
 *
 * Layer 1 (primitives). Plain constants: the compiler inlines them, so they
 * emit no CSS and the full Tailwind vocabulary costs nothing to carry here.
 * Only tokens that need to change per theme belong in `theme/semantic.ts`.
 */

export const duration = {
  "0": "0s",
  "75": "75ms",
  "100": "100ms",
  "150": "150ms",
  "200": "200ms",
  "300": "300ms",
  "450": "450ms",
  "500": "500ms",
  "700": "700ms",
  "1000": "1000ms",
  /** Tailwind's `animate-pulse` is two seconds; nothing shorter matches it. */
  "2000": "2000ms",
} as const

export const easing = {
  linear: "linear",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  /**
   * The CSS keyword, not Tailwind's `ease-out`. `tw-animate-css` falls back to
   * it for `animate-*` utilities, so a ported keyframe animation needs this
   * gentler curve rather than `out` below.
   */
  cssOut: "ease-out",
  /**
   * The CSS `ease` keyword: `tw-animate-css`'s default for `animate-in` and
   * `animate-out`. Every popup, dialog and backdrop the original animated that
   * way uses it, so `recipes/overlay.ts` does too.
   */
  cssEase: "ease",
  /** `ease-out`. Rarely correct for a Tailwind port — see `inOut`. */
  out: "cubic-bezier(0, 0, 0.2, 1)",
  /**
   * The curve `animate-pulse` carries, which is not any of Tailwind's `ease-*`
   * tokens: the utility writes it literally. Close enough to `inOut` to read
   * the same in a screenshot and not the same in a comparison.
   */
  pulse: "cubic-bezier(0.4, 0, 0.6, 1)",
  /**
   * Tailwind's default transition curve, and therefore the right one for any
   * transition the original wrote without an explicit `ease-*`. That is nearly
   * all of them, so this is the default choice here too.
   */
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  // Curves the shadcn components use for overlay and drawer motion.
  emphasized: "cubic-bezier(0.22, 1, 0.36, 1)",
  overshoot: "cubic-bezier(0.45, 1.005, 0, 1.005)",
  decelerate: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const

/** `@media (prefers-reduced-motion: reduce)`, for opting out of animation. */
export const motion = {
  reduce: "@media (prefers-reduced-motion: reduce)",
  safe: "@media (prefers-reduced-motion: no-preference)",
} as const
