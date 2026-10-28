import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


const radius = {"lg": "0.5rem", "md": "0.375rem"}
const ctx = {"gap": "var(--kvFN39)"}
const vega = '[data-style="vega"]'
const wide = "@media (min-width: 40rem)"

// A value per style, built from one table of them (KF-053): every input is known at build time,
// so the corners compile to atoms instead of runtime variables.
const END = { base: radius.lg, [vega]: radius.md, [wide]: "1rem" } as const
const perStyle = (value: (r: string) => string) =>
  Object.fromEntries(Object.entries(END).map(([key, r]) => [key, value(r)]))
// Keys, values, the index, a function expression, a block body, a missing element, and a callback
// that reads the helper's parameter.
const sides = (unit: string) =>
  Object.fromEntries(Object.keys({ top: 1, left: 2 }).map((side, index) => [side, `${index}${unit}`]))
const widths = (scale: number) =>
  Object.values({ a: 1, b: 2 }).map(function (n) {
    return n * scale
  })
const firstOf = (pairs: string[][]) => pairs.map(([, second]) => second)
const orSolid = (pairs: string[][]) => pairs.map(([, second]) => second ?? "solid")
const block = (items: string[]) =>
  items.map((item) => {
    return item
  })
const twice = (join: (a: string, b: string) => string) => join("1px", "2px")
// Every kind of key reads back as itself: a string, a condition, a contextual target, a token.
const echo = (style: object) => Object.fromEntries(Object.entries(style))
const short = () => Object.fromEntries([["opacity"]])

export const item = "ka-246u_ kb-246u_zsK3 kc-246u_wwfA kd-246u_wwfA ke-246u_zsK3 ka-STrL_ kb-STrL_BBZQ kc-STrL_wwfA kd-STrL_wwfA ke-STrL_BBZQ ka-qxdQ_ kb-qxdQ_HV2H kc-qxdQ_wwfA kd-qxdQ_wwfA ke-qxdQ_HV2H ku_FIQV kg_vqnf ks_5sOf kq_5sOf kt_8Gds k5_ k9_GvB4 k8_8bbU k6_GvB4 k7_8bbU k87_ufrO k50_D9ur k50-RekC_LB88 k5T-C9M_D9ur klJTi8_kbjD"

// What stays a runtime value: a map over a value that is not an array, an item that is not an
// array where the callback takes it apart, a pair that is not one, an object that is not one, and
// callbacks the evaluator does not run.
const overText = (text: string) => (text as unknown as string[]).map((c) => c)
const apart = (items: string[]) => items.map(([first]) => first)
const notPairs = (items: string[]) => Object.fromEntries(items as unknown as [string, string][])
const emptyPair = () => Object.fromEntries([[]])
const objectKey = () => Object.fromEntries([[{}, "red"]])
const entriesOf = (list: string[]) => Object.entries(list as unknown as object)
const keysOfText = (value: object) => Object.keys(`${value}` as unknown as object)
const mapText = (value: object) => (`${value}` as unknown as string[]).map((c) => c)
const mapObject = (items: object[]) => items.map((item) => `${item}`)
const spread = (list: string[]) => Object.entries(...[list])
const frozen = (value: string) => Object.freeze([value])[0]
const keysOfGlobal = () => Object.keys(globalThis as object)
const callsWithGlobal = (read: (from: object) => string) => read(globalThis)
const fromGlobal = () => (globalThis as unknown as { list: string[] }).list.map((item) => item)
const readsGlobal = (items: string[]) => items.map(() => globalThis.name)
const defaulted = (items: string[]) => items.map((item = "x") => item)
const rest = (items: string[]) => items.map((...all) => all[0])
const nested = (items: { a: string }[]) => items.map(({ a }) => a)
const nestedArray = (items: string[][][]) => items.map(([[a]]) => a)
const restElement = (items: string[][]) => items.map(([a, ...others]) => others[0] ?? a)
const patternSecond = (items: string[]) => items.map((item, [index]) => index ?? item)
const third = (items: string[]) => items.map((item, index, all) => all[index] ?? item)
const statements = (items: string[]) =>
  items.map((item) => {
    const out = item
    return out
  })
const statementsFunction = (items: string[]) =>
  items.map(function (item) {
    const out = item
    return out
  })
const later = (items: string[]) => items.map(async (item) => item)
const generator = (items: string[]) =>
  items.map(function* (item) {
    yield item
  })
const asyncFunction = (items: string[]) =>
  items.map(async function (item) {
    return item
  })
const named = (items: string[], pick: (item: string) => string) => items.map(pick)
function Shadowed(Object: { entries: (x: unknown) => string[] }) {
  return (value: string) => Object.entries(value)[0]
}

export const runtime = (text: string) =>
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k50_OuAg", "--k50", (overText("ab")[0])), /* @__PURE__ */ __k.b("k44_y7EM", "--k44", (apart(["ab"])[0])), /* @__PURE__ */ __k.b("k8b_NoVg", "--k8b", (notPairs(["a"]).a)), /* @__PURE__ */ __k.b("k1v_oQLM", "--k1v", (emptyPair().a)), /* @__PURE__ */ __k.b("k1m_FFnR", "--k1m", (objectKey().a)), /* @__PURE__ */ __k.b("k4U_LXeA", "--k4U", (entriesOf(["a"])[0])), /* @__PURE__ */ __k.b("k9j_hM7R", "--k9j", (keysOfText({ a: 1 })[0])), /* @__PURE__ */ __k.b("k66_ItKJ", "--k66", (mapText({ a: 1 })[0])), /* @__PURE__ */ __k.b("k7e_pSfp", "--k7e", (mapObject([{ a: 1 }])[0])), /* @__PURE__ */ __k.b("k9h_Lfef", "--k9h", (spread(["red"])[0])), /* @__PURE__ */ __k.b("k99_IReK", "--k99", (frozen("red"))), /* @__PURE__ */ __k.b("k1o_Bcnb", "--k1o", (keysOfGlobal()[0])), /* @__PURE__ */ __k.b("k1w_LtJj", "--k1w", (callsWithGlobal(() => "red"))), /* @__PURE__ */ __k.b("k9L_WxyE", "--k9L", (fromGlobal()[0])), /* @__PURE__ */ __k.b("k1n_rAng", "--k1n", (readsGlobal(["red"])[0])), /* @__PURE__ */ __k.b("k3B_kwz4", "--k3B", (defaulted(["red"])[0])), /* @__PURE__ */ __k.b("ko_sniH", "--ko", (nested([{ a: "red" }])[0])), /* @__PURE__ */ __k.b("km_jXt3", "--km", (third(["red"])[0])), /* @__PURE__ */ __k.b("kl_yTYu", "--kl", (statements(["red"])[0])), /* @__PURE__ */ __k.b("kn_JYRm", "--kn", (statementsFunction(["red"])[0])), /* @__PURE__ */ __k.b("k8d_Frq4", "--k8d", (rest(["solid"])[0])), /* @__PURE__ */ __k.b("k58_p3zk", "--k58", (nestedArray([[["solid"]]])[0])), /* @__PURE__ */ __k.b("k1p_BS8c", "--k1p", (restElement([["solid"]])[0])), /* @__PURE__ */ __k.b("k1y_f8qg", "--k1y", (patternSecond(["solid"])[0])), /* @__PURE__ */ __k.b("k57_0b2p", "--k57", (later(["red"])[0])), /* @__PURE__ */ __k.b("k9D_zGDU", "--k9D", (named(["red"], (item) => item)[0])), /* @__PURE__ */ __k.b("k5T_eJ5M", "--k5T", (Shadowed({ entries: () => [text] })("red"))), /* @__PURE__ */ __k.b("k47_ k44_ k45_ k48_ k49_ k4a_ k4b_ k41_ k46_ k43_ k40_9anN", "--k40", (generator(["red"])[0])), /* @__PURE__ */ __k.b("k5n_bOc8", "--k5n", (asyncFunction(["x"])[0])))
