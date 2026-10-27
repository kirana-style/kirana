import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


const space = {"8": "2rem", "9": "2.25rem"}
const colors = {"ring": "var(--kvkup3)"}

// An optional value: a key the object lacks reads as `undefined`, whatever it holds (KF-039).
const pick = (value: { base: string; mira?: string }) => ({
  base: value.base,
  ...(value.mira ? { ":hover": value.mira } : {}),
})
// `in` on a static object.
const has = (value: { base: string; mira?: string }) => ("mira" in value ? value.mira : value.base)
// A token compared with a string, and with itself.
const ring = (color: string) => (color === "none" ? "none" : `0 0 0 2px ${color}`)
const same = (a: string, b: string) => (a === b ? "1px" : "2px")
// A default parameter, read when the argument is absent (KF-040), and one reading the parameter
// before it.
const shadow = (color: string, later = `0 0 0 1px ${color}`) => ({ base: `0 0 0 3px ${color}`, ":hover": later })
const inset = (size = "1px", edge = `${size} solid`) => edge
// A default that does not fold leaves the helper a runtime function; one that fails for the
// argument given leaves that call a runtime value.
const late = (size = globalThis.innerWidth) => size
const deep = (value: number, size = (value as unknown as { size: string }).size) => size
// A token group read through a helper with a key it lacks: still an error, at the call.
const step = (n: number) => space[n]

export const box = "k4_5QUl k1_5QUl k1-KFHz_La0C k9_La0C k6_La0C k4M_5Jqb k4M-KFHz_kr9c k4C_ kg_Jl4D kq_L7uX kl_1SlD k4j_ ki_FEoY ks_L7uX kn_1SlD kj_eK8R kh_kbjD"

export const card = /* @__PURE__ */ __k.recipe({"s": null, "b": ["k0_ugRr"], "v": {"tone": {"quiet": ["k4M_Im6t"], "loud": ["k4M_5Jqb k4M-KFHz_bZnJ"]}}, "c": [], "d": {}})

export const focus = "k4M_Daph"

export const runtime = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kJ_tbhO", "--kJ", (late())), /* @__PURE__ */ __k.b("kK_fMuJ", "--kK", (deep(1))))

export const typo = ""
