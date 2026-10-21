// Style objects as components write them: plain values, conditions, nesting, pseudo-elements,
// condition values and composition.
import { container, css, cx, media, supports } from "@kirana-style/core"

const md = media("(width >= 48rem)")

export const card = css({
  display: "flex",
  flexDirection: { base: "column", [md]: "row" },
  gap: { base: "0.5rem", [md]: "1rem" },
  padding: "1rem",
  borderRadius: "0.75rem",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: {
    base: "gainsboro",
    ":hover": "silver",
    ":focus-within": "gray",
  },
  backgroundColor: {
    base: "white",
    ":hover": { base: "whitesmoke", [md]: "gainsboro" },
    '[data-state="open"]': "ghostwhite",
  },
  color: "black",
  fontSize: "0.875rem",
  lineHeight: 1.5,
  height: { base: "100vh", [supports("(height: 100dvh)")]: "100dvh" },
  "::after": {
    content: '""',
    position: "absolute",
    insetInline: 0,
    blockSize: "1px",
    backgroundColor: { base: "gainsboro", ":hover": "black" },
  },
})

export const title = css({
  fontWeight: 600,
  letterSpacing: "-0.01em",
  textWrap: "balance",
  flexDirection: { [container("(width >= 24rem)", "card")]: "row" },
})

export const muted = css({
  color: { base: "gray", "[aria-disabled]": "silver" },
})

export const header = cx(title, muted)
export const extended = css(card, { padding: { base: "1rem", [md]: "1.5rem" } })
