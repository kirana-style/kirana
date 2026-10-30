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
   * The CSS keyword, gentler than `out` below: `tw-animate-css` falls back to it
   * for keyframe animations, so a ported one uses this.
   */
  cssOut: "ease-out",
  /**
   * The CSS `ease` keyword, `tw-animate-css`'s default for `animate-in` and
   * `animate-out`, so the popups, dialogs and backdrops in `recipes/overlay.ts` use it.
   */
  cssEase: "ease",
  /** `ease-out`. Rarely correct for a Tailwind port; see `inOut`. */
  out: "cubic-bezier(0, 0, 0.2, 1)",
  /**
   * The curve `animate-pulse` writes literally, which is none of Tailwind's
   * `ease-*` tokens. It looks like `inOut` but does not compare equal.
   */
  pulse: "cubic-bezier(0.4, 0, 0.6, 1)",
  /** Tailwind's default transition curve, so the default for any transition without an explicit `ease-*`. */
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  // Overlay and drawer motion.
  emphasized: "cubic-bezier(0.22, 1, 0.36, 1)",
  overshoot: "cubic-bezier(0.45, 1.005, 0, 1.005)",
  decelerate: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const

/** `@media (prefers-reduced-motion: reduce)`, for opting out of animation. */
export const motion = {
  reduce: "@media (prefers-reduced-motion: reduce)",
  safe: "@media (prefers-reduced-motion: no-preference)",
} as const
