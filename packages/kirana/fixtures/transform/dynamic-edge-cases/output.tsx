import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = __kirana_runtime("k", "className");


const group = {"name": "group", "anchor": "krYXFN"}
const media = "@media (width >= 48rem)"
const handle = "k50_D9ur"

export function Edge({ on, value, list }: { on: boolean; value: string; list: string[] }) {
  return (
    <div className="krYXFN">
      <p {...__k.sx([__k.b("k50-0w85_ISJz", "--k50-0w85", (on ? "red" : value))], [], [])} />
      <p {...__k.sx([__k.b("k50-9RcJ_Ycuw", "--k50-9RcJ", (value))], [], [])} />
      <p {...__k.sx([__k.b("kaF-C9M_w2yB", "--kaF-C9M", (value))], [], [])} />
      <p {...__k.sx([(on) ? "" : "k50_D9ur"], [], [])} />
      <p  />
      <p  />
      <p  />
      <p {...__k.sx([(on) ? "k50_D9ur" : ""], [], [])} />
      <p {...__k.sx([(on ? list : handle)], [], [])} />
      <p {...__k.sx([(styleProps(...list))], [], [])} />
      <p {...__k.sx([(on && [handle, value])], [], [])} />
      <p {...__k.sx([__k.b("k50_OuAg", "--k50", (`${value}`))], [], [])} />
      <p {...__k.sx([(on) ? "k50_D9ur" : "", (on || handle), (value) ? "k50_D9ur" : ""], [], [])} />
    </div>
  )
}
export const conditionalValue = "k50_D9ur k44_LB88"
export const nestedCss = ""
