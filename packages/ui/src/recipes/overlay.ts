/**
 * Enter and exit motion for anything that pops over the page: dialog, sheet,
 * drawer, dropdown, select, combobox, tooltip, toast.
 *
 * shadcn drove this with `tw-animate-css` keyframes — `animate-in fade-in-0
 * zoom-in-95 data-[side=bottom]:slide-in-from-top-2`. That package is gone, and
 * keyframes are the wrong tool here anyway: Base UI marks an element with
 * `data-starting-style` on the frame it mounts and `data-ending-style` while it
 * closes, which is exactly what a transition needs. Transitions also reverse
 * mid-flight, so a menu closed while still opening animates from where it
 * actually is rather than snapping.
 *
 * All the motion properties live in one namespace, so the enter and exit
 * states read together. A component that sets a plain `opacity` keeps them:
 * merging replaces only the entry with the same conditions.
 *
 * Timing follows `tw-animate-css`, not Tailwind's transition defaults:
 * `animate-in` is the CSS `ease` keyword, and every shadcn popup, dialog and
 * dialog backdrop sets `duration-100`. A component that differs overrides
 * `transitionDuration` or `transitionTimingFunction` after this style: the
 * tooltip keeps the 150ms default, and the sheet's backdrop is a plain Tailwind
 * transition.
 */

import { css } from "@kirana-style/core"

import { duration, easing } from "../tokens/motion"
import { spacing } from "../tokens/spacing"

/** How far a positioned popup travels on entry. Tailwind's `slide-in-from-*-2`. */
const SLIDE = spacing[2]

export const overlayStyles = {
  /**
   * A popup anchored to a trigger. Fades and scales, and slides in from the
   * side it is anchored against so the motion points back at its trigger.
   */
  popup: css({
    transformOrigin: "var(--transform-origin)",
    transitionProperty: "opacity, scale, translate",
    transitionDuration: duration[100],
    transitionTimingFunction: easing.cssEase,

    opacity: {
      base: 1,
      "[data-starting-style]": 0,
      "[data-ending-style]": 0,
    },
    scale: {
      base: 1,
      "[data-starting-style]": 0.95,
      "[data-ending-style]": 0.95,
    },
    translate: {
      base: "0",
      "[data-starting-style]": {
        base: "0",
        '[data-side="top"]': `0 ${SLIDE}`,
        '[data-side="bottom"]': `0 calc(${SLIDE} * -1)`,
        '[data-side="left"]': `${SLIDE} 0`,
        '[data-side="right"]': `calc(${SLIDE} * -1) 0`,
        '[data-side="inline-start"]': `${SLIDE} 0`,
        '[data-side="inline-end"]': `calc(${SLIDE} * -1) 0`,
      },
    },
  }),

  /** A centred modal. No directional slide — it scales in place. */
  modal: css({
    transitionProperty: "opacity, scale",
    transitionDuration: duration[100],
    transitionTimingFunction: easing.cssEase,
    opacity: {
      base: 1,
      "[data-starting-style]": 0,
      "[data-ending-style]": 0,
    },
    scale: {
      base: 1,
      "[data-starting-style]": 0.95,
      "[data-ending-style]": 0.95,
    },
  }),

  /**
   * A panel that slides in from an edge of the viewport: Sheet, and the
   * non-draggable parts of Drawer. The travel distance is larger than a popup's
   * because the panel itself is large.
   */
  panel: css({
    transitionProperty: "opacity, translate",
    transitionDuration: duration[200],
    transitionTimingFunction: easing.inOut,
    opacity: {
      base: 1,
      "[data-starting-style]": 0,
      "[data-ending-style]": 0,
    },
    translate: {
      base: "0",
      "[data-starting-style]": {
        base: "0",
        '[data-side="top"]': "0 -2.5rem",
        '[data-side="bottom"]': "0 2.5rem",
        '[data-side="left"]': "-2.5rem 0",
        '[data-side="right"]': "2.5rem 0",
      },
      "[data-ending-style]": {
        base: "0",
        '[data-side="top"]': "0 -2.5rem",
        '[data-side="bottom"]': "0 2.5rem",
        '[data-side="left"]': "-2.5rem 0",
        '[data-side="right"]': "2.5rem 0",
      },
    },
  }),

  /** The dimmed backdrop behind a modal. Fades only. */
  backdrop: css({
    transitionProperty: "opacity",
    transitionDuration: duration[100],
    transitionTimingFunction: easing.cssEase,
    opacity: {
      base: 1,
      "[data-starting-style]": 0,
      "[data-ending-style]": 0,
    },
  }),
}
