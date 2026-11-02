// Everything here only declares values: an importer whose every read is folded need not load it.
import type { Deep } from "./more"
import { defineTokens } from "@kirana-style/core"
import { base } from "./base"

export * from "./more"
export { deep as shade } from "./more"
export type { Deep as Alias } from "./more"
;
export const space = defineTokens("space", { md: "1rem", lg: `${base}rem` })
export const flags = [true, null, 1, 2n, "a", /x/, , ...[1]]
export const shape = { a: 1, ["b"]: 2, ...{ c: 3 }, get d() { return 1 } }
export const math = (-1 + 2 * 3 && !false ? typeof base : void 0)
export const reads = shape.a ?? base
export const pick = shape["a"]
export const typed = ((base as number)! satisfies number)
export const arrow = () => 1
export const plainFunction = function () {}
export function helper() {}
export type Local = Deep
export interface Face {}
const local = 1
export { local }
export default { local }
