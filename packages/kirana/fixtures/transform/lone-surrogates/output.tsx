import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");
// Strings holding a lone surrogate, which oxc keeps as written since 0.155: none is a CSS value,
// a key, a class or a module specifier, so each is left unevaluated, never mangled.

import { jsx } from "react/jsx-runtime"
import { lone } from "\uD800"
import Lone from "\uD801"
import { fromReexport, fromStar, namespaced, plain } from "./reexports"

enum Names {
  Plain = "1px",
  "\uD800" = "2px",
}
const keyed = (value: string) => ({ "\uD800": value })
const templated = (value: string) => `\uD800${value}`

export const values = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (lone)), "k6V_eK8R", /* @__PURE__ */ __k.b("k9_ZhSI", "--k9", (fromReexport)), /* @__PURE__ */ __k.b("k6_fYDk", "--k6", (namespaced)), "k1_eK8R")

export const keys = ""

export function Dynamic({ size }: { size: string }) {
  return <div  />
}

export const Elements = () => (
  <>
    <Lone sx={values} />
    {jsx("div", { "\uD800": 1, sx: "\uD800" })}
    {jsx(Lone, { sx: "\uD800" })}
  </>
)
