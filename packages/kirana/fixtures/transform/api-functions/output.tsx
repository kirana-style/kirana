import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


const rem = (value: number) => `${value / 4}rem`
function px(value: number) {
  return `${value}px`
}
const pick = (on: boolean) => (on ? "block" : "none")
const both = (a: string, b: string) => a || b
const shape = (radius: number) => ({ top: `${radius}px`, list: [radius], ...{ extra: 1 }, [`k${radius}`]: radius })
const nested = (value: number) => rem(value) + " " + px(value)
const typed = (value: string) => typeof value === "string" && !false
const minus = (value: number) => -value
const member = (value: { a: string }) => value.a
const computed = (value: string[]) => value[0]
const unsupported = (value: number) => {
  const doubled = value * 2
  return doubled
}
const defaulted = (value = 1) => value
const rest = (...values: number[]) => values
function* generator() {}
async function later() {}

export const styles = /* @__PURE__ */ __k.cx("kaF_5QUl k6V_vqnf k5O_u3uh k5n_Ts5U kv_ES2o kw_kbjD kx_XMJ0 k5_ k9_HV2H k8_zgUg k6_HV2H k7_zgUg k87_tIfm k88_reDk k50_D9ur k44_LB88", /* @__PURE__ */ __k.b("kaO_Z0Ni", "--kaO", (unsupported(2))), "k61_tIfm", /* @__PURE__ */ __k.b("k63_3ALG", "--k63", (rest(1)[0])))
export { generator, later }
