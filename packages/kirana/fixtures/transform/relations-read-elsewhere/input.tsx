// Style entries other modules spread into their styles: this module imports a relation and reads it,
// but has no `css()` and names no Kirana package, so only its reads say it holds styles (KF-051).
import { fieldLabel } from "./scope"

const IN_FOCUSED_CARD = fieldLabel.within(":has(:focus-visible)")

export const checkEntries = {
  outlineWidth: { base: "0", [IN_FOCUSED_CARD]: "2px" },
  opacity: { [fieldLabel.parent()]: 0.9, [fieldLabel.after(":hover")]: 0.8 },
}

// A DOM method of the same name passes the prefilter, and is left as written.
export function insertAfter(node: Element, next: Element) {
  node.after(next)
  return node.parentElement?.before(next)
}
