/**
 * Keyframes for the animation utilities: Tailwind CSS v4's `spin`, `ping`, `pulse` and `bounce`, and
 * tw-animate-css's `enter`, `exit`, accordion, collapsible and caret keyframes (MIT; see the README).
 * `enter` and `exit` read the `compose` layers that `fade-in-0`, `zoom-in-95` and `slide-in-from-top-2`
 * set.
 */
import { keyframes } from "@kirana-style/core"

import { compose } from "./compose.ts"

const accordion =
  "var(--radix-accordion-content-height, var(--bits-accordion-content-height, var(--reka-accordion-content-height, var(--kb-accordion-content-height, var(--ngp-accordion-content-height, auto)))))"
const collapsible =
  "var(--radix-collapsible-content-height, var(--bits-collapsible-content-height, var(--reka-collapsible-content-height, var(--kb-collapsible-content-height, auto))))"

export const animation = {
  enter: keyframes({
    from: {
      opacity: compose["enter-opacity"],
      transform: `translate3d(${compose["enter-translate-x"]}, ${compose["enter-translate-y"]}, 0) scale3d(${compose["enter-scale"]}, ${compose["enter-scale"]}, ${compose["enter-scale"]}) rotate(${compose["enter-rotate"]})`,
      filter: `blur(${compose["enter-blur"]})`,
    },
  }),
  exit: keyframes({
    to: {
      opacity: compose["exit-opacity"],
      transform: `translate3d(${compose["exit-translate-x"]}, ${compose["exit-translate-y"]}, 0) scale3d(${compose["exit-scale"]}, ${compose["exit-scale"]}, ${compose["exit-scale"]}) rotate(${compose["exit-rotate"]})`,
      filter: `blur(${compose["exit-blur"]})`,
    },
  }),
  spin: keyframes({ to: { transform: "rotate(360deg)" } }),
  ping: keyframes({ "75%, 100%": { transform: "scale(2)", opacity: 0 } }),
  pulse: keyframes({ "50%": { opacity: 0.5 } }),
  bounce: keyframes({
    "0%, 100%": {
      transform: "translateY(-25%)",
      animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
    },
    "50%": {
      transform: "none",
      animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
    },
  }),
  "accordion-down": keyframes({
    from: { height: 0 },
    to: { height: accordion },
  }),
  "accordion-up": keyframes({ from: { height: accordion }, to: { height: 0 } }),
  "collapsible-down": keyframes({
    from: { height: 0 },
    to: { height: collapsible },
  }),
  "collapsible-up": keyframes({
    from: { height: collapsible },
    to: { height: 0 },
  }),
  "caret-blink": keyframes({
    "0%, 70%, 100%": { opacity: 1 },
    "20%, 50%": { opacity: 0 },
  }),
}
