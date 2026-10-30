// Objects with a key or a spread decided at runtime, bound to a name and used as a style. Each is
// reported where the key or spread is written, or, imported, where the style uses it: compiled as a
// runtime handle, it would apply nothing.
import { css } from "@kirana-style/core"

import { parts, spreadParts } from "./parts"

const side = Math.random() > 0.5 ? "left" : "right"
const extra = Math.random() > 0.5 ? { color: "red" } : {}

const keyed = { display: "grid", [side]: 0 }
const spread = { display: "grid", ...extra }
const again = keyed

export const local = css(keyed)
export const spreads = css(spread)
export const renamed = css(again)
export const spreadOfLocal = css({ ...keyed, color: "red" })
export const imported = css(parts)
export const spreadOfImport = css({ ...parts, color: "red" })
export const importedSpread = css(spreadParts)

// A value read from such an object is a runtime value like any other: it is bridged.
const colors = { [side]: "red" }
export const read = css({ color: colors.left })

export function Card() {
  return <div sx={keyed} />
}
