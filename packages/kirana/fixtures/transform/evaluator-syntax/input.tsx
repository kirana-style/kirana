import { css } from "@kirana-style/core"
import paddingOf, { reexported, value, notExported } from "./exports"
import Anonymous from "./anonymous"
import { asserted } from "./assertions"

let reassigned = "1px"
reassigned = "2px"
const holes = [, "b"]
const withMethod = { method() { return 1 } }
const withGetter = { get value() { return 1 } }
const withPrivate = class { #x = 1 }
const spreadArray = [...["a", "b"], ...holes]
const functionExpression = function (size: number) { return `${size}rem` }
const optional = { deep: { value: "3px" } } as { deep?: { value: string } } | undefined
const nothing = undefined as { value: string } | undefined
enum Numbers { Zero, One, Five = 5, Six, "Quoted" = "q" }
enum Computed { [`template`] = "t" }
enum NonLiteral { Runtime = Math.random() }
const numericObject = { 1: "one", 2.5: "twoAndHalf" }
const logical = (a: string | undefined) => a ?? "fallback"
const conditional = (on: boolean) => (on ? "yes" : "no")
const plus = (value: string) => +value
const loweredObject = (value: string) => ({ "quoted": value, 3: value })
const loweredArray = (value: string) => [value, ...[value]]
const loweredCall = (value: number) => paddingOf(value)
const loweredAs = (value: string) => (value as string) satisfies string
const loweredNonFunctionCall = (value: number) => value(1)
const loweredBadUnary = (value: number) => void value
const loweredSpreadCall = (value: number[]) => Math.max(...value)
const loweredOptional = (value: { a?: string }) => value?.a

export const styles = css({
  width: reassigned,
  height: holes[1],
  content: `"${spreadArray.length}${withMethod}${withGetter}${withPrivate}"`,
  padding: functionExpression(2),
  margin: optional?.deep?.value,
  marginTop: nothing?.value,
  marginBottom: optional?.["deep"]?.value,
  order: Numbers.Six,
  zIndex: Numbers.Five,
  flexGrow: Numbers.One,
  flexShrink: Numbers.Zero,
  fontFamily: Numbers.Quoted,
  fontStyle: Computed.template,
  tabSize: NonLiteral.Runtime,
  columnCount: numericObject[1] === "one" && numericObject[2.5] ? 2 : 1,
  color: logical(undefined),
  backgroundColor: conditional(false),
  lineHeight: plus("1.5"),
  borderTopColor: loweredObject("red").quoted,
  borderLeftColor: loweredObject("red")[3],
  borderRightColor: loweredArray("blue")[1],
  paddingTop: loweredCall(4),
  outlineColor: loweredAs("green"),
  opacity: loweredNonFunctionCall(1),
  letterSpacing: loweredBadUnary(1),
  wordSpacing: loweredSpreadCall([1]),
  textIndent: loweredOptional({ a: "1px" }),
  top: paddingOf(8),
  bottom: reexported,
  left: `${value}px`,
  right: notExported,
  inset: Anonymous as never,
}, asserted)
