/**
 * A target a finger can hit: at least 44 × 44 px on a touch screen (WCAG 2.5.5), and the size it
 * was drawn at everywhere else, so a dense desktop bar stays dense. Add it to any small control a
 * phone reader taps: icon buttons, segmented toggles, chip links.
 */
import { css } from "@kirana-style/core"

import { pointer } from "../tokens/breakpoints"

export const touchTarget = css({
  minWidth: { [pointer.coarse]: "2.75rem" },
  minHeight: { [pointer.coarse]: "2.75rem" },
})
