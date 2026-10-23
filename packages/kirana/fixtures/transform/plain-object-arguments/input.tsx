import { css, cx } from "@kirana-style/core"

// Each builds a plain object at runtime, which no merge can apply.
export const fromEntries = css(Object.fromEntries([["color", "blue"]]))
export const assigned = css({ display: "grid" }, Object.assign({}, { color: "red" }))
export const created = cx(Object.create(null))
export const parsed = css(JSON.parse('{"color":"red"}'))
export const cloned = css(structuredClone({ color: "red" }))
const built = Object.fromEntries([["color", "green"]])
export const throughBinding = css(built)
export const InSx = () => <div sx={(Object.fromEntries([]))} />

// Still fine: a handle known only at runtime, a value read from a runtime object, a local that
// happens to be called Object, and a built-in that returns no object.
export function Card({ sx, theme }: { sx?: string; theme: { brand: string } }) {
  return <div sx={[css({ padding: "1px" }), sx]} style={{}}>{css({ color: theme.brand })}</div>
}
const tones = Object.fromEntries([["brand", "navy"]]) as { brand: string }
export const fromRuntime = (on: boolean) => css({ color: on ? tones.brand : "red" })
const Object2 = { fromEntries: (x: unknown) => x }
export const notGlobal = css(Object2.fromEntries([]) as string)
export function Shadowed({ Object }: { Object: { assign: () => string } }) {
  return css(Object.assign())
}
export const keys = css(Object.keys({}) as unknown as string)
