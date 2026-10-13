

const hover = ":hover"
// Literal computed keys are the author's own: their diagnostics point at them.
export const literal = "k5O_fqMV"
// A key shared through a binding stands for every place it is used, so it keeps the argument span.
export const shared = ""
// A style object declared apart from css() still reports at its properties.
const card = { padding: "1px;", margin: { [":hover"]: 3 } }
export const apart = ""
