/**
 * The registered custom property behind the scroll-fade mask.
 *
 * `syntax` registers it with `@property`, which is what makes the value
 * animatable — an unregistered custom property cannot be interpolated, so the
 * fade would snap rather than grow.
 */

import { defineTokens } from "@kirana-style/core"

export const scrollFadeVars = defineTokens("scrollFadeVars", {
  /** How far the fade currently reaches in from the trailing edge. */
  size: { value: "0px", syntax: "<length-percentage>", inherits: false },
})
