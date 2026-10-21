import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");

import { fromA, fromB, list, missingStar } from "./star-a"

const field = {"name": "field", "anchor": "krWdRU"}
const generic = <T,>(value: T) => value
const call = (value: number) => `${value}px`
const identity = (value: string) => value
const methodObject = (value: string) => ({ m() { return value } })
const spreadCall = (value: number[]) => call(...value)
const computedKey = (value: string) => ({ [{} as never]: value })
const numericKey = (value: string) => ({ [1]: value })
const spreadNonObject = (value: string) => ({ ...value })
const { ["computed"]: fromPattern } = { computed: "5px" }
const [fromNonArray] = "string" as unknown as string[]
const optionalCall = (() => "6px") as undefined | (() => string)
const instantiated = generic<string>
const power = (value: number) => `${value ** 2}px`
// @ts-expect-error -- a deliberate cycle
const cycleA = cycleB
const cycleB = cycleA
const [head, ...tail] = ["11px", "12px"]
const nonNull = { a: "10deg" } as { a?: string } | undefined

export const edges = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (((((((("1px"))))))))), "k6V_eJRk k9_kbjD kS_DeBs k6_ES2o k7_vqnf", /* @__PURE__ */ __k.b("k4_yAYs", "--k4", (fromPattern)), /* @__PURE__ */ __k.b("k1_IyYz", "--k1", (fromNonArray)), "k2_l82H k3_l82H kv_WDdC kw_webL kx_quzb", /* @__PURE__ */ __k.b("ky_AnFZ", "--ky", (call(1, 2))), /* @__PURE__ */ __k.b("k5n_bOc8", "--k5n", (`"${spreadCall([1])}"`)), /* @__PURE__ */ __k.b("k8F_rp3K", "--k8F", (`"${methodObject("x")}"`)), /* @__PURE__ */ __k.b("k56_cclF", "--k56", (`${computedKey("x")}`)), "kL_eK8R", /* @__PURE__ */ __k.b("kK_fMuJ", "--kK", (`${spreadNonObject("x")}`)), /* @__PURE__ */ __k.b("k9P_bGIB", "--k9P", (call(...[1]))), "k8R_tIfm k8K_RXRW", /* @__PURE__ */ __k.b("k4z_29xp", "--k4z", (`${2 ** 2}px`)), /* @__PURE__ */ __k.b("k5b_99nW", "--k5b", (cycleA)), "k7S_yqjH", /* @__PURE__ */ __k.b("k7P_oRnM", "--k7P", (tail)), /* @__PURE__ */ __k.b("k8c_kKm5", "--k8c", (power(2))), "k87_ufrO", /* @__PURE__ */ __k.b("kaO_Z0Ni", "--kaO", (~1)), "k88_tIfm", /* @__PURE__ */ __k.b("k61_1Y3S", "--k61", (({ a: 1 } as { a?: number })?.["a"])))
export const conditions = [undefined, undefined, undefined]
export const tokenKeys = {"ok": "2px"}
export const recipes = [
  /* @__PURE__ */ __k.recipe({"s": ["root"], "b": [""], "v": {}, "c": [], "d": {}}),
  /* @__PURE__ */ __k.recipe({"s": null, "b": [""], "v": {"size": {}}, "c": [[{}, [""]]], "d": {}}),
  /* @__PURE__ */ __k.recipe({"s": null, "b": [""], "v": {}, "c": [[{}, [""]]], "d": {}}),
]
const sized = /* @__PURE__ */ __k.recipe({"s": null, "b": [""], "v": {"size": {"sm": ["k6V_eK8R"]}}, "c": [], "d": {}})
export const called = "k6V_eK8R"
export const unknownValues = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
]
export function Handles({ w }: { w: string }) {
  return ""
}
export const shortVariable = "ku_mqka k5_0utk"
