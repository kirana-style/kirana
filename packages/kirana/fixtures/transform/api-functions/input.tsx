import { css } from "@kirana-style/core"

const rem = (value: number) => `${value / 4}rem`
function px(value: number) {
  return `${value}px`
}
const pick = (on: boolean) => (on ? "block" : "none")
const both = (a: string, b: string) => a || b
const shape = (radius: number) => ({ top: `${radius}px`, list: [radius], ...{ extra: 1 }, [`k${radius}`]: radius })
const nested = (value: number) => rem(value) + " " + px(value)
const typed = (value: string) => typeof value === "string" && !false
const minus = (value: number) => -value
const member = (value: { a: string }) => value.a
const computed = (value: string[]) => value[0]
const unsupported = (value: number) => {
  const doubled = value * 2
  return doubled
}
const defaulted = (value = 1) => value
const rest = (...values: number[]) => values
function* generator() {}
async function later() {}

export const styles = css({
  width: rem(8),
  height: px(4),
  display: pick(true),
  content: both("", "'x'"),
  top: shape(3).top,
  bottom: `${shape(2).list[0]}px`,
  left: `${shape(5).k5}px`,
  margin: nested(4),
  opacity: typed("x") ? 1 : 0,
  order: minus(2),
  color: member({ a: "red" }),
  backgroundColor: computed(["blue"]),
  zIndex: unsupported(2),
  flexGrow: defaulted(),
  flexShrink: rest(1)[0],
})
export { generator, later }
