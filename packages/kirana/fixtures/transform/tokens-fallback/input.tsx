import * as kirana from "@kirana-style/core"
import { css, defineTokens, fallback, firstThatWorks, keyframes } from "@kirana-style/core"

import { fade, plain } from "./fade"

// The top edge's depth, else every edge's, else a default: one chain, read on the element.
const TOP = fallback(fade.top, fade.size, "min(12%, 2.5rem)")

const reveal = keyframes({
  from: { [fade.depth]: "0px" },
  to: { [fade.depth]: fallback(fade.bottom, fade.size, "2.5rem") },
})

export const region = css({
  animationName: reveal,
  maskImage: `linear-gradient(transparent 0, #000 ${TOP})`,
  paddingBlockStart: TOP,
  // A number ends a chain too; an unset token alone reads as nothing, and is not checked.
  opacity: fallback(fade.strength, 1),
  paddingInlineStart: fade.top,
})

// A region sets only the knobs it changes, typed and checked like any token.
export const deep = css({ [fade.size]: "6rem" })
export const shallowTop = css({ [fade.top]: "0.5rem" })

// A chain may end in a token, or in another chain.
export const ends = css({
  marginBlockStart: fallback(fade.top, plain.gap),
  marginBlockEnd: fallback(fade.bottom, fallback(fade.size, "1rem")),
})

// Through a namespace import as well.
export const inline = css({ marginInline: kirana.fallback(fade.size, "1rem") })

// A token's default may read a chain too; a variable token's default is read on the root.
export const edges = defineTokens("edges", { top: fallback(fade.top, "1rem") }, { variable: true })

// Outside a style the chain is its text.
export const TOP_TEXT = TOP

// Rejected: a token with a value is never unset, nor is one written in place; the first value is
// not a token; nothing to fall back to; a last value known only at runtime, or not one CSS value;
// an end the property does not take; a chain as a key.
export const always = css({ width: fallback(fade.depth, "1rem") })
export const inlined = css({ width: fallback(plain.gap, "1rem") })
export const notToken = css({ width: fallback("1rem" as never, "2rem") })
export const alone = css({ width: fallback(fade.top as never) })
export const runtime = css({ width: fallback(fade.top, String(Math.random())) })
export const several = css({ height: fallback(fade.top, firstThatWorks("100dvh", "100vh")) })
export const colour = css({ width: fallback(fade.top, fallback(fade.size, "red")) })
export const assigned = css({ [fallback(fade.top, "1rem")]: "2rem" })
