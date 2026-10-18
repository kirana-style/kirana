import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "class");


const box = "k5O_fqMV"

// Solid: `sx` compiles to `class`; dynamic values bridge through custom properties, which Solid's
// style object sets as written.
export function A(props: { w: number; on: boolean }) {
  return (
    <>
      <div class="k5O_fqMV" />
      <div {...__k.sx(["k5O_fqMV", (props.on) ? "k87_ufrO" : ""], ["own"], [])} />
      <div {...__k.sx([/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (props.w))], [], [])} />
      <div {...{"class": "k5O_fqMV"}} />
    </>
  )
}
