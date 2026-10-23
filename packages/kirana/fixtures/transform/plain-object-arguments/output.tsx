import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


// Each builds a plain object at runtime, which no merge can apply.
export const fromEntries = ""
export const assigned = "k5O_fqMV"
export const created = ""
export const parsed = ""
export const cloned = ""
const built = Object.fromEntries([["color", "green"]])
export const throughBinding = ""
export const InSx = () => <div  />

// Still fine: a handle known only at runtime, a value read from a runtime object, a local that
// happens to be called Object, and a built-in that returns no object.
export function Card({ sx, theme }: { sx?: string; theme: { brand: string } }) {
  return <div {...__k.sx(["k0_GvB4", (sx)], [], [({})])}>{/* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k50_OuAg", "--k50", (theme.brand)))}</div>
}
const tones = Object.fromEntries([["brand", "navy"]]) as { brand: string }
export const fromRuntime = (on: boolean) => /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k50_OuAg", "--k50", (on ? tones.brand : "red")))
const Object2 = { fromEntries: (x: unknown) => x }
export const notGlobal = ""
export function Shadowed({ Object }: { Object: { assign: () => string } }) {
  return /* @__PURE__ */ __k.cx((Object.assign()))
}
export const keys = /* @__PURE__ */ __k.cx((Object.keys({})))
