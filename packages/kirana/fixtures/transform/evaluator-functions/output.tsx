import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


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
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k5n_bOc8", "--k5n", (inTemplate(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (memberObject(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (memberProperty([1])))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (binaryLeft(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (binaryRight(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (logicalLeft(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (logicalRight(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (conditionalTest(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (conditionalThen(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (conditionalElse(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (unaryArgument(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (asInner(1)[1]))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (satisfiesInner(1)[1]))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (spreadArgument(1).v))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (computedKey(1)[0]))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (propertyValue(1).v))),
]

export const applying = [
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (call(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (templateCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (templateArray(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (objectCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (keyCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (keyArray(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (keyDynamic(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (addLeft(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (addRight(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (subtractArray(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (negateCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (negateArray(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (orLeft(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (orRight(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (testCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (thenCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (elseCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (valueCall(1).a))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (computedCall(1)[1]))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (computedArray(1)[1]))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (itemCall(1)[0]))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (calleeCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (argumentCall(1)))),
  /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (tooManyArguments(1)))),
]

// Static values from other constructs.
enum Sizes {
  ["small"] = "1px",
}
const { gap = "3px" } = { gap: "2px" }
const field = {"name": "field", "anchor": "krEtLv"}
const orFallback = (v: string) => v || "4px"
export const statics = "k6V_eK8R kJ_ASX8 k5n_btnY kaF_XMJ0"
