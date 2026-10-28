// Style entries other modules spread into their styles: this module imports a relation and reads it,
// but has no `css()` and names no Kirana package, so only its reads say it holds styles (KF-051).
import { fieldLabel } from "./scope"

const IN_FOCUSED_CARD = "relation Within .krqFy5:has(:focus-visible)"

export const checkEntries = {
  outlineWidth: { base: "0", [IN_FOCUSED_CARD]: "2px" },
  opacity: { ["relation Parent .krqFy5"]: 0.9, ["relation After .krqFy5:hover"]: 0.8 },
}

// A DOM method of the same name passes the prefilter, and is left as written.
export function insertAfter(node: Element, next: Element) {
  node.after(next)
  return node.parentElement?.before(next)
}
