import { container, css, media, supports } from "@kirana-style/core"

const md = media("(width >= 48rem)")
const card = container("(min-width: 20rem)", "card")
const any = container("(min-width: 30rem)")
const grid = supports("(display: grid)")

export const box = css({
  display: { base: "block", [grid]: { [md]: "grid" } },
  gap: { [card]: "1rem", [any]: "2rem" },
  color: {
    ":hover": "red",
    "[data-state=\"open\"]": "blue",
    ":nth-child(2n + 1)": "green",
    "@container sidebar (min-width: 10rem)": "black",
    "@supports not (display: grid)": "white",
  },
  "::before": { content: "''", position: "absolute", opacity: { ":hover": 0.5 } },
  "::-webkit-scrollbar": { width: 0 },
})
