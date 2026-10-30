import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");
// Objects with a key or a spread decided at runtime, bound to a name and used as a style. Each is
// reported where the key or spread is written, or, imported, where the style uses it: compiled as a
// runtime handle, it would apply nothing.


import { parts, spreadParts } from "./parts"

const side = Math.random() > 0.5 ? "left" : "right"
const extra = Math.random() > 0.5 ? { color: "red" } : {}

const keyed = { display: "grid", [side]: 0 }
const spread = { display: "grid", ...extra }
const again = keyed

export const local = ""
export const spreads = ""
export const renamed = ""
export const spreadOfLocal = ""
export const imported = ""
export const spreadOfImport = ""
export const importedSpread = ""

// A value read from such an object is a runtime value like any other: it is bridged.
const colors = { [side]: "red" }
export const read = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k50_OuAg", "--k50", (colors.left)))

export function Card() {
  return <div  />
}
