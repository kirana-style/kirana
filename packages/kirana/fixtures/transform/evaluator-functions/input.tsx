import { css, relation } from "@kirana-style/core"

// Each function below has one part the compiler cannot evaluate, in a different position, so every
// call compiles as a runtime value.

// Parts that do not lower: `window` is a global with no static value.
const inTemplate = (v: number) => `${window}${v}`
const memberObject = (v: number) => (window as never)[v]
const memberProperty = (v: number[]) => v[window as never]
const binaryLeft = (v: number) => (window as never) + v
const binaryRight = (v: number) => v + (window as never)
const logicalLeft = (v: number) => window || v
const logicalRight = (v: number) => v || window
const conditionalTest = (v: number) => (window ? v : v)
const conditionalThen = (v: number) => (v ? window : v)
const conditionalElse = (v: number) => (v ? v : window)
const unaryArgument = (v: number) => -(window as never) + v
const asInner = (v: number) => [window as never, v]
const satisfiesInner = (v: number) => [window satisfies unknown, v]
const spreadArgument = (v: number) => ({ ...window, v })
const computedKey = (v: number) => ({ [window as never]: v })
const propertyValue = (v: number) => ({ a: window, v })

// Parts that lower but fail when applied: `v()` calls a number.
const call = (v: any) => v()
const templateCall = (v: any) => `${v()}`
const templateArray = (v: any) => `${[v]}`
const objectCall = (v: any) => v().a
const keyCall = (v: any) => v[v()]
const keyArray = (v: any) => v[[v] as never]
const keyDynamic = (v: any) => v.a
const addLeft = (v: any) => v() + 1
const addRight = (v: any) => 1 + v()
const subtractArray = (v: any) => ([v] as never) - 1
const negateCall = (v: any) => -v()
const negateArray = (v: any) => -([v] as never)
const orLeft = (v: any) => v() || 1
const orRight = (v: any) => 0 || v()
const testCall = (v: any) => (v() ? 1 : 2)
const thenCall = (v: any) => (1 ? v() : 2)
const elseCall = (v: any) => (0 ? 1 : v())
const valueCall = (v: any) => ({ a: v() })
const computedCall = (v: any) => ({ [v()]: 1 })
const computedArray = (v: any) => ({ [[v] as never]: 1 })
const itemCall = (v: any) => [v()]
const calleeCall = (v: any) => v()()
const argumentCall = (v: any) => ((x: any) => x)(v())
const tooManyArguments = (v: any) => ((x: any) => x)(v, 2)

export const lowering = [
  css({ content: inTemplate(1) }),
  css({ width: memberObject(1) }),
  css({ width: memberProperty([1]) }),
  css({ width: binaryLeft(1) }),
  css({ width: binaryRight(1) }),
  css({ width: logicalLeft(1) }),
  css({ width: logicalRight(1) }),
  css({ width: conditionalTest(1) }),
  css({ width: conditionalThen(1) }),
  css({ width: conditionalElse(1) }),
  css({ width: unaryArgument(1) }),
  css({ width: asInner(1)[1] }),
  css({ width: satisfiesInner(1)[1] }),
  css({ width: spreadArgument(1).v }),
  css({ width: computedKey(1)[0] }),
  css({ width: propertyValue(1).v }),
]

export const applying = [
  css({ width: call(1) }),
  css({ width: templateCall(1) }),
  css({ width: templateArray(1) }),
  css({ width: objectCall(1) }),
  css({ width: keyCall(1) }),
  css({ width: keyArray(1) }),
  css({ width: keyDynamic(1) }),
  css({ width: addLeft(1) }),
  css({ width: addRight(1) }),
  css({ width: subtractArray(1) }),
  css({ width: negateCall(1) }),
  css({ width: negateArray(1) }),
  css({ width: orLeft(1) }),
  css({ width: orRight(1) }),
  css({ width: testCall(1) }),
  css({ width: thenCall(1) }),
  css({ width: elseCall(1) }),
  css({ width: valueCall(1).a }),
  css({ width: computedCall(1)[1] }),
  css({ width: computedArray(1)[1] }),
  css({ width: itemCall(1)[0] }),
  css({ width: calleeCall(1) }),
  css({ width: argumentCall(1) }),
  css({ width: tooManyArguments(1) }),
]

// Static values from other constructs.
enum Sizes {
  ["small"] = "1px",
}
const { gap = "3px" } = { gap: "2px" }
const field = relation("field")
const orFallback = (v: string) => v || "4px"
export const statics = css({ height: Sizes.small, gap, content: `"${field.name}"`, width: orFallback("5px") })
