import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = __kirana_runtime("k", "className");

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

export const styles = __k.cx(__k.b("kaF_ZFLY", "--kaF", (reassigned)), "k6V_WKEC", __k.b("k5n_bOc8", "--k5n", (`"${spreadArray.length}${withMethod}${withGetter}${withPrivate}"`)), "k0_xmAD k5_pq3K k6_ES2o k88_O8AE kaO_Gn1q k61_tIfm k63_oD60 k69_puAz", __k.b("k6j_JJqs", "--k6j", (Computed.template)), __k.b("k9s_fXG3", "--k9s", (NonLiteral.Runtime)), "k53_SyNM k50_vIsY k44_crui k7h_aXik", __k.b("kl_yTYu", "--kl", (loweredObject("red").quoted)), __k.b("ko_sniH", "--ko", (loweredObject("red")[3])), __k.b("km_jXt3", "--km", (loweredArray("blue")[1])), "k4_vqnf k8b_49ob", __k.b("k87_arAB", "--k87", (loweredNonFunctionCall(1))), __k.b("k7d_mDfl", "--k7d", (loweredBadUnary(1))), __k.b("kaJ_4ffC", "--kaJ", (loweredSpreadCall([1]))), __k.b("k9P_bGIB", "--k9P", (loweredOptional({ a: "1px" }))), "kv_WDdC kw_kbjD kx_eK8R", __k.b("ku_OAhx", "--ku", (Anonymous)), "kaF_eK8R")
