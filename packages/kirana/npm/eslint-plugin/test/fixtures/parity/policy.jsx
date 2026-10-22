import { css, recipe } from "@kirana-style/core"

export const card = css({
  display: "table",
  float: "left",
  marginInlineStart: "1rem",
  paddingLeft: "1rem",
  borderTopRightRadius: "4px",
})
export const badge = recipe({
  base: { display: { base: "grid", ":hover": "block" } },
  variants: { side: { end: { right: 0 } } },
})
