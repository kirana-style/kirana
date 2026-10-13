/**
 * Layer 3: shared keyframes, replacing `tw-animate-css`.
 *
 * `keyframes()` returns a name usable as `animationName` from any module; the
 * `@keyframes` rule is emitted once, and only when a style references it.
 *
 * Only looping animations live here. The enter/exit motion that shadcn drove
 * with `animate-in` / `animate-out` utilities is handled by plain transitions
 * against Base UI's own `data-starting-style` and `data-ending-style`
 * attributes, which is both simpler and interruptible mid-flight.
 */

import { keyframes } from "@kirana-style/core"

const spin = keyframes({
  to: { transform: "rotate(360deg)" },
})

const pulse = keyframes({
  "50%": { opacity: 0.5 },
})

const caretBlink = keyframes({
  "0%, 70%, 100%": { opacity: 1 },
  "20%, 50%": { opacity: 0 },
})

const shimmer = keyframes({
  from: { backgroundPositionX: "100%" },
  to: { backgroundPositionX: "0%" },
})

export const animation = { spin, pulse, caretBlink, shimmer } as const
