/**
 * Shared looping keyframes. `keyframes()` returns a name usable as
 * `animationName` from any module; the rule is emitted once, and only when a
 * style references it. Enter and exit motion is transitions instead
 * (`recipes/overlay.ts`).
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
