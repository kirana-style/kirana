/**
 * The custom properties Tailwind CSS v4 composes utilities through (`ring-2` and `shadow-sm` one layer
 * each of `box-shadow`, `blur-sm` one step of `filter`), as registered tokens the grammar reads
 * (`{compose.ring-shadow}`). `inherits: false`, as Tailwind registers `--tw-*`, so a parent's ring
 * never reaches a child's shadow. A filter step has no value, so `filter` lists only the steps set.
 */
import { defineTokens } from "@kirana-style/core"

// Written out rather than built by a helper: the compiler folds them, and nothing runs here.
export const compose = defineTokens("compose", {
  shadow: { value: "0 0 #0000", syntax: "*", inherits: false },
  "inset-shadow": { value: "0 0 #0000", syntax: "*", inherits: false },
  "ring-shadow": { value: "0 0 #0000", syntax: "*", inherits: false },
  "inset-ring-shadow": { value: "0 0 #0000", syntax: "*", inherits: false },
  "ring-offset-shadow": { value: "0 0 #0000", syntax: "*", inherits: false },
  "ring-width": { value: "0px", syntax: "*", inherits: false },
  "ring-color": { value: "currentcolor", syntax: "*", inherits: false },
  "translate-x": { value: "0", syntax: "*", inherits: false },
  "translate-y": { value: "0", syntax: "*", inherits: false },
  "scale-x": { value: "1", syntax: "*", inherits: false },
  "scale-y": { value: "1", syntax: "*", inherits: false },
  "border-style": { value: "solid", syntax: "*", inherits: false },
  "outline-style": { value: "solid", syntax: "*", inherits: false },
  // Transitions: Tailwind's defaults until `duration-*` and `ease-*` set them.
  "transition-duration": { value: "0.15s", syntax: "*", inherits: false },
  "transition-ease": {
    value: "cubic-bezier(0.4, 0, 0.2, 1)",
    syntax: "*",
    inherits: false,
  },
  // Filter steps, unset until a utility sets them.
  blur: { syntax: "*", inherits: false },
  brightness: { syntax: "*", inherits: false },
  contrast: { syntax: "*", inherits: false },
  grayscale: { syntax: "*", inherits: false },
  "hue-rotate": { syntax: "*", inherits: false },
  invert: { syntax: "*", inherits: false },
  saturate: { syntax: "*", inherits: false },
  sepia: { syntax: "*", inherits: false },
  "drop-shadow": { syntax: "*", inherits: false },
  "backdrop-blur": { syntax: "*", inherits: false },
  "backdrop-brightness": { syntax: "*", inherits: false },
  "backdrop-contrast": { syntax: "*", inherits: false },
  "backdrop-grayscale": { syntax: "*", inherits: false },
  "backdrop-hue-rotate": { syntax: "*", inherits: false },
  "backdrop-invert": { syntax: "*", inherits: false },
  "backdrop-opacity": { syntax: "*", inherits: false },
  "backdrop-saturate": { syntax: "*", inherits: false },
  "backdrop-sepia": { syntax: "*", inherits: false },
  // Animation layers (tw-animate-css): the initial values are the plugin's fallbacks.
  "animation-duration": { value: "0.15s", syntax: "*", inherits: false },
  "animation-ease": { value: "ease", syntax: "*", inherits: false },
  "enter-opacity": { value: "1", syntax: "*", inherits: false },
  "enter-scale": { value: "1", syntax: "*", inherits: false },
  "enter-rotate": { value: "0", syntax: "*", inherits: false },
  "enter-translate-x": { value: "0", syntax: "*", inherits: false },
  "enter-translate-y": { value: "0", syntax: "*", inherits: false },
  "enter-blur": { value: "0", syntax: "*", inherits: false },
  "exit-opacity": { value: "1", syntax: "*", inherits: false },
  "exit-scale": { value: "1", syntax: "*", inherits: false },
  "exit-rotate": { value: "0", syntax: "*", inherits: false },
  "exit-translate-x": { value: "0", syntax: "*", inherits: false },
  "exit-translate-y": { value: "0", syntax: "*", inherits: false },
  "exit-blur": { value: "0", syntax: "*", inherits: false },
})
