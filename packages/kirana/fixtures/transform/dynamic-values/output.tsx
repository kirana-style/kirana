import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


const base = "k50_W0yl"
const active = "k50_D9ur"

export function Meter({ value, tone, on, props, key, extra }: { value: number; tone: "ok" | "warn"; on: boolean; props: { sx?: string }; key: string; extra: object }) {
  return (
    <div>
      <p {...__k.sx([/* @__PURE__ */ __k.b("k76_7YFQ", "--k76", (`${value}%`)), (tone === "ok") ? "k50_49ob" : "k50_jnlc"], [], [])} />
      <p {...__k.sx([/* @__PURE__ */ __k.b("k0_NlYA", "--k0", (value)), /* @__PURE__ */ __k.b("kaG-aje_b9et", "--kaG-aje", (value)), /* @__PURE__ */ __k.b("k6W-aje-KFHz_867i", "--k6W-aje-KFHz", (value))], [], [])} />
      <p {...__k.sx([/* @__PURE__ */ __k.b("k5_gplW", "--k5", (on ? "1px" : `${value}px`))], [], [])} />
      <p {...__k.sx(["k50_W0yl", (on) ? "k50_D9ur" : "", (props.sx), (on) ? "k50_D9ur" : ""], [], [])} />
      <p {...__k.sx(["k50_W0yl", (on) ? "k50_D9ur" : "", (props.sx)], [], [])} />
      <p {...__k.sx([(on) ? "" : "k50_LB88"], [], [])} />
      <p  />
      <p  />
      <p className="k50_D9ur" />
      <p {...__k.sx([...((on ? [base] : [active]))], [], [])} />
      <p {...__k.sx([([...(on ? [base] : []), active])], [], [])} />
      <p {...__k.sx([(on ? base : props.sx)], [], [])} />
    </div>
  )
}
