import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");

import paddingOf, { reexported, value, notExported } from "./exports"
import Anonymous from "./anonymous"
import { asserted } from "./assertions"

let reassigned = "1px"
reassigned = "2px"
const holes = [, "b"]
const withMethod = { method() { return 1 } }
const withGetter = { get value() { return 1 } }
const withPrivate = class { #x = 1 }
const spreadArray = [...["a", "b"], ...holes]
const functionExpression = function (size: number) { return `${size}rem` }
const optional = { deep: { value: "3px" } } as { deep?: { value: string } } | undefined
const nothing = undefined as { value: string } | undefined
enum Numbers { Zero, One, Five = 5, Six, "Quoted" = "q" }
enum Computed { [`template`] = "t" }
enum NonLiteral { Runtime = Math.random() }
const numericObject = { 1: "one", 2.5: "twoAndHalf" }
const logical = (a: string | undefined) => a ?? "fallback"
const conditional = (on: boolean) => (on ? "yes" : "no")
const plus = (value: string) => +value
const loweredObject = (value: string) => ({ "quoted": value, 3: value })
const loweredArray = (value: string) => [value, ...[value]]
const loweredCall = (value: number) => paddingOf(value)
const loweredAs = (value: string) => (value as string) satisfies string
const loweredNonFunctionCall = (value: number) => value(1)
const loweredBadUnary = (value: number) => void value
const loweredSpreadCall = (value: number[]) => Math.max(...value)
const loweredOptional = (value: { a?: string }) => value?.a

export const styles = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaG_5ath", "--kaG", (reassigned)), "k6W_WKEC", /* @__PURE__ */ __k.b("k5o_VcRc", "--k5o", (`"${spreadArray.length}${withMethod}${withGetter}${withPrivate}"`)), "k0_xmAD k5_pq3K k6_ES2o k89_O8AE kaP_Gn1q k62_tIfm k64_oD60 k6a_puAz", /* @__PURE__ */ __k.b("k6k_Xbea", "--k6k", (Computed.template)), /* @__PURE__ */ __k.b("k9t_zeEn", "--k9t", (NonLiteral.Runtime)), "k54_SyNM k50_vIsY k44_crui k7i_aXik", /* @__PURE__ */ __k.b("kl_yTYu", "--kl", (loweredObject("red").quoted)), /* @__PURE__ */ __k.b("ko_sniH", "--ko", (loweredObject("red")[3])), /* @__PURE__ */ __k.b("km_jXt3", "--km", (loweredArray("blue")[1])), "k4_vqnf k8c_49ob", /* @__PURE__ */ __k.b("k88_vq3u", "--k88", (loweredNonFunctionCall(1))), /* @__PURE__ */ __k.b("k7e_pSfp", "--k7e", (loweredBadUnary(1))), /* @__PURE__ */ __k.b("kaK_XMs8", "--kaK", (loweredSpreadCall([1]))), /* @__PURE__ */ __k.b("k9Q_vukK", "--k9Q", (loweredOptional({ a: "1px" }))), "kv_WDdC kw_kbjD kx_eK8R", /* @__PURE__ */ __k.b("ku_OAhx", "--ku", (Anonymous)), "kaG_eK8R")
