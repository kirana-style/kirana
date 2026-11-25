import { css } from "@kirana-style/core"

// `color-interpolation` is a property, and `margin-trim` takes the block keywords, since
// mdn-data 2.38.
export const fine = css({
  colorInterpolation: { base: "linearRGB", ":hover": "auto" },
  marginTrim: { base: "block", ":hover": "block-start block-end" },
})

// `margin-trim`'s old grammar is gone: `all` is a word other grammars know, so it is refused.
export const all = css({ marginTrim: "all" })

// `in-flow` no grammar names any more, so it is left alone as CSS newer than the data.
export const inFlow = css({ marginTrim: "in-flow" })
