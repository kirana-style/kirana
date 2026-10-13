import { container, css, defineTokens, media, mode, recipe, relation, select, supports } from "@kirana-style/core"
import { fromA, fromB, list, missingStar } from "./star-a"

const field = relation("field")
const generic = <T,>(value: T) => value
const call = (value: number) => `${value}px`
const identity = (value: string) => value
const methodObject = (value: string) => ({ m() { return value } })
const spreadCall = (value: number[]) => call(...value)
const computedKey = (value: string) => ({ [{} as never]: value })
const numericKey = (value: string) => ({ [1]: value })
const spreadNonObject = (value: string) => ({ ...value })
const { ["computed"]: fromPattern } = { computed: "5px" }
const [fromNonArray] = "string" as unknown as string[]
const optionalCall = (() => "6px") as undefined | (() => string)
const instantiated = generic<string>
const power = (value: number) => `${value ** 2}px`
// @ts-expect-error -- a deliberate cycle
const cycleA = cycleB
const cycleB = cycleA
const [head, ...tail] = ["11px", "12px"]
const nonNull = { a: "10deg" } as { a?: string } | undefined

export const edges = css({
  width: (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((("1px")))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))),
  height: generic<string>("7px"),
  marginTop: fromB,
  paddingBlock: fromA,
  marginBottom: list[0] as string,
  marginLeft: (list[1] as { nested: string }).nested,
  marginRight: missingStar,
  paddingTop: fromPattern,
  paddingBottom: fromNonArray,
  paddingLeft: optionalCall?.(),
  paddingRight: optionalCall!?.(),
  top: (field as never as { bogus: string }).bogus ?? "8px",
  bottom: (select as never as { bogus: string }).bogus ?? "9px",
  left: `${mode.nope}`,
  right: call(1, 2),
  content: `"${spreadCall([1])}"`,
  quotes: `"${methodObject("x")}"`,
  columnRule: `${computedKey("x")}`,
  columnGap: numericKey("x")[1],
  rowGap: `${spreadNonObject("x")}`,
  textIndent: call(...[1]),
  scale: instantiated("1"),
  rotate: nonNull?.a!,
  borderSpacing: `${2 ** 2}px`,
  columnWidth: cycleA,
  maxWidth: head,
  maxHeight: tail as never,
  outlineOffset: power(2),
  opacity: +"0.5",
  zIndex: ~1,
  order: identity?.("1"),
  flexGrow: ({ a: 1 } as { a?: number })?.["a"],
})
export const conditions = [media(1 as never), supports(), container()]
export const tokenKeys = defineTokens("keys", { [media("(x)") as never]: "1px", flag: true, ok: "2px" })
export const recipes = [
  recipe({ slots: ["root"], base: "not an object" as never }),
  recipe({ variants: { size: { [media("(x)") as never]: {} } }, compoundVariants: [{ size: {}, css: {} }] }),
  recipe({ variants: { tone: "loud" as never }, compoundVariants: ["loud" as never], defaultVariants: "loud" as never }),
]
const sized = recipe({ variants: { size: { sm: { height: "1px" } } } })
export const called = sized({ [media("(x)") as never]: "sm", size: "sm" })
export const unknownValues = [
  css({ m() { return 1 } }),
  css({ [media("(x)")]: { color: "red" } }),
  css({ color: { "hover": "red" } }),
  css({ colour: { "*": null } }),
  css({ [{} as never]: "red" }),
  css({ [1 as never]: "red" }),
  css({ 1n: "red" } as never),
]
export function Handles({ w }: { w: string }) {
  return css({ color: css({ width: w }) as never })
}
export const shortVariable = css({ inset: "var(--kv)", margin: "var(--kvab)" })
