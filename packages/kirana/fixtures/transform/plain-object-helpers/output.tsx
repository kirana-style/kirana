import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");



// Each is a helper whose every `return` is an object literal, so a call of it is never a handle,
// and the compiler cannot fold this call: it is reported where it stopped (KF-085).
const split = (names: string) => ({ animationName: names.split(",").map((name) => name.trim()).join(", ") })
export const methodCall = "k50_D9ur"

const reveal = (value: string, count = 1) => {
  const each = (item: string) => (count === 2 ? `${item}, ${item}` : item)
  return { maskImage: each(value) }
}
export const statements = ""

function branches(on: boolean) {
  function ignored() {
    return "a nested function's return is its own"
  }
  if (on) return { color: "red" } as const
  return { color: ignored() } satisfies object
}
export const declared = ""

const sized = (width: number) => ({ width })
export function Runtime({ w }: { w: number }) {
  return <div  />
}

const picked = ({ tone }: { tone: string }) => ({ color: tone })
export const pattern = ""

const rest = (...tones: string[]) => ({ color: tones[0] })
export const restParameter = ""

const dated = (when = new Date()) => ({ color: String(when) })
export const unfoldedDefault = ""

const defaulted = (tones: string, first = tones.split(",")) => ({ color: first })
export const failingDefault = ""

const built = (tone: string) => ({ color: new String(tone) })
export const unfoldedValue = ""

const keyed = (key: string) => ({ [new String(key) as unknown as string]: "red" })
export const unfoldedKey = ""

const spread = (value: string) => ({ ...(value as unknown as object) })
export const failingSpread = ""

const one: (...tones: string[]) => object = (tone: string) => ({ color: tone.toUpperCase() })
export const extraArgument = ""

const bound = split("c")
export const throughBinding = ""
export const imported = ""
export const InSx = () => <div  />

// Still fine: a helper that folds, one that may return a handle, a call of a runtime value, and a
// call read in a value.
const plain = (value: string) => ({ maskImage: value })
export const folded = "k7D_g2Fu"
const on = "k50_D9ur"
const off = "k50_LB88"
function pick(active: boolean) {
  if (active) return on
  return off
}
export function Picked({ active }: { active: boolean }) {
  return <div {...__k.sx([(pick(active))], [], [])} />
}
const styleFor = (globalThis as unknown as { styleFor: () => string }).styleFor
export const fromRuntime = /* @__PURE__ */ __k.cx((styleFor()))
export function Valued({ w }: { w: number }) {
  return <div {...__k.sx([/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (sized(w).width))], [], [])} />
}
