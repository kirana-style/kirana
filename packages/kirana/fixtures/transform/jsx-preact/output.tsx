import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = __kirana_runtime("k", "class");


const box = "k5O_fqMV k50_W0yl k50-KFHz_D9ur"
const wide = "kaF_yp7g"

// Preact: `sx` compiles to `class`, and a `className` the element already has joins it.
export function A({ on, w, rest }: { on: boolean; w: number; rest: object }) {
  return (
    <>
      <div class="k5O_fqMV k50_W0yl k50-KFHz_D9ur" />
      <div {...__k.sx(["k5O_fqMV k50_W0yl k50-KFHz_D9ur"], ["own"], [])} />
      <div {...__k.sx(["k5O_fqMV k50_W0yl k50-KFHz_D9ur", (on) ? "kaF_yp7g" : ""], ["legacy"], [])} />
      <div {...__k.sx([__k.b("kaF_ZFLY", "--kaF", (w))], [], [({ opacity: 1 })])} />
      <div {...rest} {...__k.sx(["k5O_fqMV k50_W0yl k50-KFHz_D9ur"], [(rest)?.class], [(rest)?.style])} />
      <input {...{"class": "k5O_fqMV k50_W0yl k50-KFHz_D9ur"}} />
    </>
  )
}
