import { css } from "@kirana-style/core"

const hover = ":hover"
// Literal computed keys are the author's own: their diagnostics point at them.
export const literal = css({
  display: "grid",
  [":focus"]: { color: "red" },
  width: { [`:active`]: 5, [0]: "1px" },
})
// A key shared through a binding stands for every place it is used, so it keeps the argument span.
export const shared = css({ [hover]: { color: "red" } })
// A style object declared apart from css() still reports at its properties.
const card = { padding: "1px;", margin: { [":hover"]: 3 } }
export const apart = css(card)
