/**
 * A mask that fades content out at the end of a scroll container, and only while
 * there is something still to scroll to.
 *
 * Ported from the `scroll-fade` utility in the ejected Tailwind layer. The
 * mechanism survives intact: a scroll-driven animation grows a registered custom
 * property as the container approaches its end, and a mask reads that property.
 * Browsers without `animation-timeline` get the fade unconditionally, which is
 * the same fallback the original declared.
 */

import { css, keyframes } from "@kirana-style/core"

import { scrollFadeVars } from "../tokens/scroll-fade"

/** How tall the fade grows to. */
const FADE = "min(12%, 2.5rem)"

const reveal = keyframes({
  from: { [scrollFadeVars.size]: "0px" },
  to: { [scrollFadeVars.size]: FADE },
})

const SUPPORTS_SCROLL_TIMELINE = "@supports (animation-timeline: scroll())"
const NO_SCROLL_TIMELINE = "@supports not (animation-timeline: scroll())"

export const scrollFadeStyles = {
  /** Fades the bottom edge. */
  bottom: css({
    maskImage: `linear-gradient(to bottom, #000 0, #000 calc(100% - ${scrollFadeVars.size}), transparent 100%)`,
    maskRepeat: "no-repeat",

    animationName: { base: "none", [SUPPORTS_SCROLL_TIMELINE]: reveal },
    animationDuration: { [SUPPORTS_SCROLL_TIMELINE]: "1ms" },
    animationTimingFunction: {
      [SUPPORTS_SCROLL_TIMELINE]: "ease-in-out",
    },
    animationFillMode: { [SUPPORTS_SCROLL_TIMELINE]: "both" },
    // Ties the animation's progress to this element's own vertical scrolling,
    // running over the last stretch before the end.
    animationTimeline: {
      [SUPPORTS_SCROLL_TIMELINE]: "scroll(self y)",
    },
    animationDirection: {
      [SUPPORTS_SCROLL_TIMELINE]: "reverse",
    },
    animationRange: {
      [SUPPORTS_SCROLL_TIMELINE]: "calc(100% - 6rem) 100%",
    },

    // Without scroll-driven animations the fade is simply always present.
    [scrollFadeVars.size]: { base: "0px", [NO_SCROLL_TIMELINE]: FADE },
  }),
}
