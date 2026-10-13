/**
 * Shared chrome for text-entry controls: input, textarea, native select, and
 * the triggers that are meant to read as fields.
 *
 * This is one namespace rather than a set of mixins so every state of the
 * chrome (focus, invalid, disabled) is declared, and overridden, in one place.
 * Kirana merges per property *and* condition, so a component that sets a plain
 * `borderColor` keeps the focus and invalid colours below.
 *
 * Components compose this with their own box metrics (height, padding, font
 * size), which touch different properties and so merge cleanly.
 */

import { css } from "@kirana-style/core"

import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"

export const controlStyles = {
  /**
   * The resting field: bordered, transparent in light mode and a translucent
   * fill in dark, with a focus ring that validation state overrides.
   */
  field: css({
    width: "100%",
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,

    backgroundColor: {
      base: surface.control,
      ":disabled": surface.controlDisabled,
    },
    borderColor: {
      base: theme.input,
      ":focus-visible": theme.ring,
      // Validation is declared last so it outranks focus: an invalid field
      // stays visibly invalid while it has focus.
      '[aria-invalid="true"]': surface.borderInvalid,
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
      '[aria-invalid="true"]': `0 0 0 ${ring.width} ${surface.ringInvalid}`,
    },
    cursor: { ":disabled": "not-allowed" },
    opacity: { ":disabled": 0.5 },
  }),

  /** Placeholder text, a top-level pseudo-element key. */
  placeholder: css({
    "::placeholder": { color: theme.mutedForeground },
  }),
}
