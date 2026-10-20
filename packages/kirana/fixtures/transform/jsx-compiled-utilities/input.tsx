// Compiled JSX with a utility grammar: a string `sx` is lowered on an element and handed to a
// component as its compiled handle, as the attribute is.
import { jsx as _jsx } from "remix/component/jsx-runtime"

function Card(props) {
  return _jsx("div", { ...props })
}

export function Elements() {
  return [_jsx("div", { sx: "p-4" }), _jsx(Card, { sx: "p-4" }), _jsx(Card, { sx: "unknown-utility" })]
}
