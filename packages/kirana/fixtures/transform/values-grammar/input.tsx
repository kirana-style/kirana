import { css } from "@kirana-style/core"

// A known keyword in the wrong place, a negative size and a stray comma are rejected, each naming
// the grammar it does not fit.
export const wrong = css({
  padding: "red",
  display: "center",
  width: "-4px",
  zIndex: "1.5",
  margin: "1rem,",
})

// What the grammars allow, and what they cannot judge: newer CSS than the data, a name of the
// author's own, a substitution, a function's arguments and the CSS-wide keywords.
export const fine = css({
  width: "calc-size(auto, size)",
  alignSelf: "anchor-center",
  animationName: "spin",
  paddingTop: "var(--gap)",
  color: "light-dark(black, white)",
  boxShadow: "0 0 0 2px red, inset 0 1px 0 black",
  gridTemplateColumns: "[full] 1fr [end]",
  display: { base: "inline flex", ":hover": "revert-layer" },
  marginTop: "calc(-1 * 4px)",
})
