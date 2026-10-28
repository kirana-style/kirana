import { css, defineTokens, media, select } from "@kirana-style/core"

const radius = defineTokens("radius", { lg: "0.5rem", md: "0.375rem" })
const ctx = defineTokens("ctx", { gap: "1px" }, { variable: true })
const vega = '[data-style="vega"]'
const wide = media("(min-width: 40rem)")

// A value per style, built from one table of them (KF-053): every input is known at build time,
// so the corners compile to atoms instead of runtime variables.
const END = { base: radius.lg, [vega]: radius.md, [wide]: "1rem" } as const
const perStyle = (value: (r: string) => string) =>
  Object.fromEntries(Object.entries(END).map(([key, r]) => [key, value(r)]))
// Keys, values, the index, a function expression, a block body, a missing element, and a callback
// that reads the helper's parameter.
const sides = (unit: string) =>
  Object.fromEntries(Object.keys({ top: 1, left: 2 }).map((side, index) => [side, `${index}${unit}`]))
const widths = (scale: number) =>
  Object.values({ a: 1, b: 2 }).map(function (n) {
    return n * scale
  })
const firstOf = (pairs: string[][]) => pairs.map(([, second]) => second)
const orSolid = (pairs: string[][]) => pairs.map(([, second]) => second ?? "solid")
const block = (items: string[]) =>
  items.map((item) => {
    return item
  })
const twice = (join: (a: string, b: string) => string) => join("1px", "2px")
// Every kind of key reads back as itself: a string, a condition, a contextual target, a token.
const echo = (style: object) => Object.fromEntries(Object.entries(style))
const short = () => Object.fromEntries([["opacity"]])

export const item = css(
  {
    borderRadius: { ":first-child": perStyle((r) => `${r} 0 0 ${r}`) },
    inset: sides("px").top,
    borderTopWidth: `${widths(2)[1]}px`,
    borderBottomStyle: firstOf([["a", "solid"]])[0],
    borderTopStyle: orSolid([["a"]])[0],
    borderLeftStyle: block(["dashed"])[0],
    margin: twice((a, b) => `${a} ${b}`),
    opacity: short().opacity ?? 0.5,
  },
  echo({ color: { base: "red", [wide]: "blue" }, [select.descendant("svg")]: { fill: "red" }, [ctx.gap]: "2px" })
)

// What stays a runtime value: a map over a value that is not an array, an item that is not an
// array where the callback takes it apart, a pair that is not one, an object that is not one, and
// callbacks the evaluator does not run.
const overText = (text: string) => (text as unknown as string[]).map((c) => c)
const apart = (items: string[]) => items.map(([first]) => first)
const notPairs = (items: string[]) => Object.fromEntries(items as unknown as [string, string][])
const emptyPair = () => Object.fromEntries([[]])
const objectKey = () => Object.fromEntries([[{}, "red"]])
const entriesOf = (list: string[]) => Object.entries(list as unknown as object)
const keysOfText = (value: object) => Object.keys(`${value}` as unknown as object)
const mapText = (value: object) => (`${value}` as unknown as string[]).map((c) => c)
const mapObject = (items: object[]) => items.map((item) => `${item}`)
const spread = (list: string[]) => Object.entries(...[list])
const frozen = (value: string) => Object.freeze([value])[0]
const keysOfGlobal = () => Object.keys(globalThis as object)
const callsWithGlobal = (read: (from: object) => string) => read(globalThis)
const fromGlobal = () => (globalThis as unknown as { list: string[] }).list.map((item) => item)
const readsGlobal = (items: string[]) => items.map(() => globalThis.name)
const defaulted = (items: string[]) => items.map((item = "x") => item)
const rest = (items: string[]) => items.map((...all) => all[0])
const nested = (items: { a: string }[]) => items.map(({ a }) => a)
const nestedArray = (items: string[][][]) => items.map(([[a]]) => a)
const restElement = (items: string[][]) => items.map(([a, ...others]) => others[0] ?? a)
const patternSecond = (items: string[]) => items.map((item, [index]) => index ?? item)
const third = (items: string[]) => items.map((item, index, all) => all[index] ?? item)
const statements = (items: string[]) =>
  items.map((item) => {
    const out = item
    return out
  })
const statementsFunction = (items: string[]) =>
  items.map(function (item) {
    const out = item
    return out
  })
const later = (items: string[]) => items.map(async (item) => item)
const generator = (items: string[]) =>
  items.map(function* (item) {
    yield item
  })
const asyncFunction = (items: string[]) =>
  items.map(async function (item) {
    return item
  })
const named = (items: string[], pick: (item: string) => string) => items.map(pick)
function Shadowed(Object: { entries: (x: unknown) => string[] }) {
  return (value: string) => Object.entries(value)[0]
}

export const runtime = (text: string) =>
  css({
    color: overText("ab")[0],
    backgroundColor: apart(["ab"])[0],
    outlineColor: notPairs(["a"]).a,
    borderBlockColor: emptyPair().a,
    borderInlineColor: objectKey().a,
    caretColor: entriesOf(["a"])[0],
    stroke: keysOfText({ a: 1 })[0],
    floodColor: mapText({ a: 1 })[0],
    lightingColor: mapObject([{ a: 1 }])[0],
    stopColor: spread(["red"])[0],
    scrollbarColor: frozen("red"),
    borderInlineEndColor: keysOfGlobal()[0],
    borderBlockStartColor: callsWithGlobal(() => "red"),
    textEmphasisColor: fromGlobal()[0],
    borderInlineStartColor: readsGlobal(["red"])[0],
    accentColor: defaulted(["red"])[0],
    borderLeftColor: nested([{ a: "red" }])[0],
    borderRightColor: third(["red"])[0],
    borderTopColor: statements(["red"])[0],
    borderBottomColor: statementsFunction(["red"])[0],
    outlineStyle: rest(["solid"])[0],
    columnRuleStyle: nestedArray([[["solid"]]])[0],
    borderInlineStyle: restElement([["solid"]])[0],
    borderBlockStyle: patternSecond(["solid"])[0],
    columnRuleColor: later(["red"])[0] as unknown as string,
    textDecorationColor: named(["red"], (item) => item)[0],
    fill: Shadowed({ entries: () => [text] })("red"),
    background: generator(["red"])[0] as unknown as string,
    content: asyncFunction(["x"])[0] as unknown as string,
  })
