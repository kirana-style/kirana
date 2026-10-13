import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = __kirana_runtime("k", "class");
import { component$, useSignal } from "@qwik.dev/core"


const box = "k5O_fqMV"

// Qwik: `sx` compiles to `class`; dynamic values bridge through custom properties in Qwik's style
// object, and the handles stay module-level constants the optimizer's `$` segments import.
export const A = component$((props: { w: number }) => {
  const on = useSignal(false)
  return (
    <>
      <div class="k5O_fqMV" />
      <div {...__k.sx(["k5O_fqMV", (on.value) ? "k87_ufrO" : ""], ["own"], [])} />
      <div {...__k.sx([__k.b("kaF_ZFLY", "--kaF", (props.w))], [], [])} />
      <div {...{"class": "k5O_fqMV"}} />
    </>
  )
})
