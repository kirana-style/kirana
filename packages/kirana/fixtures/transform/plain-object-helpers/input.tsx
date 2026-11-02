import { css } from "@kirana-style/core"
import { shared } from "./helpers"

// Each is a helper whose every `return` is an object literal, so a call of it is never a handle,
// and the compiler cannot fold this call: it is reported where it stopped (KF-085).
const split = (names: string) => ({ animationName: names.split(",").map((name) => name.trim()).join(", ") })
export const methodCall = css(split("a, b"), { color: "red" })

const reveal = (value: string, count = 1) => {
  const each = (item: string) => (count === 2 ? `${item}, ${item}` : item)
  return { maskImage: each(value) }
}
export const statements = css(reveal("linear-gradient(red, blue)"))

function branches(on: boolean) {
  function ignored() {
    return "a nested function's return is its own"
  }
  if (on) return { color: "red" } as const
  return { color: ignored() } satisfies object
}
export const declared = css(branches(true))

const sized = (width: number) => ({ width })
export function Runtime({ w }: { w: number }) {
  return <div sx={sized(w)} />
}

const picked = ({ tone }: { tone: string }) => ({ color: tone })
export const pattern = css(picked({ tone: "red" }))

const rest = (...tones: string[]) => ({ color: tones[0] })
export const restParameter = css(rest("red"))

const dated = (when = new Date()) => ({ color: String(when) })
export const unfoldedDefault = css(dated())

const defaulted = (tones: string, first = tones.split(",")) => ({ color: first })
export const failingDefault = css(defaulted("red, blue"))

const built = (tone: string) => ({ color: new String(tone) })
export const unfoldedValue = css(built("red"))

const keyed = (key: string) => ({ [new String(key) as unknown as string]: "red" })
export const unfoldedKey = css(keyed("color"))

const spread = (value: string) => ({ ...(value as unknown as object) })
export const failingSpread = css(spread("x"))

const one: (...tones: string[]) => object = (tone: string) => ({ color: tone.toUpperCase() })
export const extraArgument = css(one("red", "blue"))

const bound = split("c")
export const throughBinding = css(bound)
export const imported = css(shared("red"))
export const InSx = () => <div sx={split("d")} />

// Still fine: a helper that folds, one that may return a handle, a call of a runtime value, and a
// call read in a value.
const plain = (value: string) => ({ maskImage: value })
export const folded = css(plain("linear-gradient(red, blue)"))
const on = css({ color: "red" })
const off = css({ color: "blue" })
function pick(active: boolean) {
  if (active) return on
  return off
}
export function Picked({ active }: { active: boolean }) {
  return <div sx={pick(active)} />
}
const styleFor = (globalThis as unknown as { styleFor: () => string }).styleFor
export const fromRuntime = css(styleFor())
export function Valued({ w }: { w: number }) {
  return <div sx={css({ width: sized(w).width })} />
}
