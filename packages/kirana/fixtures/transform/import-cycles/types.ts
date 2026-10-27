// Types and type-only re-exports name no value: evaluating this module imports none of them.
import type Shape from "./more"
import { type Deep } from "./more"

export type Keys = string
type Local = number
export const shade = "blue"
export type { Local }
export { type Local as Count, shade as hue, Shape, Deep }
export type { Deep as Alias } from "./more"
export { type Deep as Other, deep as tint } from "./more"
