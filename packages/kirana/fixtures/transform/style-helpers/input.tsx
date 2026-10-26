import { css, defineTokens, recipe } from "@kirana-style/core"

const space = defineTokens("space", { 8: "2rem", 9: "2.25rem" })
const colors = defineTokens("colors", { ring: "blue" }, { variable: true })

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

export const box = css({
  paddingTop: pick({ base: space[8] }),
  paddingBottom: pick({ base: space[8], mira: space[9] }),
  marginTop: has({ base: space[8], mira: space[9] }),
  marginBottom: has({ base: space[9] }),
  boxShadow: shadow("red"),
  borderTop: inset(),
  borderBottom: inset("2px"),
  borderLeftWidth: same(space[8], space[8]),
  borderRightWidth: same(space[8], space[9]),
})

export const card = recipe({
  base: { padding: has({ base: space[8], mira: space[9] }) },
  variants: { tone: { quiet: { boxShadow: ring("none") }, loud: { boxShadow: shadow("red", "0 0 0 1px blue") } } },
})

export const focus = css({ boxShadow: ring(colors.ring) })

export const runtime = css({ gap: late(), rowGap: deep(1) })

export const typo = css({ padding: step(7) })
