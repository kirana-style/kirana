import { css } from "@kirana-style/core"

const unit = "rem"
const size = 2
const colours = { brand: "oklch(0.7 0.2 90)", muted: "gray" } as const
const list = ["a", "b"]
const half = size / 2
const flags = { on: true, off: false, nothing: null } as const
const { brand, missing = "fallback" } = colours as typeof colours & { missing?: string }
const [first, , third = "c"] = list
enum Tone { Loud = "loud" }
const key = "opacity"
const shared = { display: "flex" }

export const values = css({
  ...shared,
  ...null,
  width: `${size}${unit}`,
  height: `${half * 3}rem`,
  marginTop: `calc(${size + 1}px - ${size - 1}px)`,
  marginBottom: `${size % 2}px`,
  color: colours.brand!,
  backgroundColor: (colours["muted"] satisfies string) as string,
  borderTopColor: brand,
  borderBottomColor: missing,
  content: `"${first}${third}${list.length}${"abc".length}${list[1]}${list[9]}"`,
  [key]: flags.on && !flags.off ? 1 : 0,
  zIndex: flags.nothing ?? 10,
  order: typeof size === "number" ? -size : +size,
  flexGrow: size > 1 && size >= 2 && size < 3 && size <= 2 && size == 2 && size != 3 ? 1 : 0,
  flexShrink: "a" < "b" && "b" > "a" && "a" <= "a" && "b" >= "b" ? 0 : 1,
  fontWeight: size === 2 && size !== 3 ? 700 : 400,
  lineHeight: flags.off || 1.5,
  tabSize: (0 && 1) || 4,
  letterSpacing: `${null}` === "null" && `${undefined}` === "undefined" && `${true}` === "true" ? "0px" : "1px",
  wordSpacing: Tone.Loud === "loud" ? "1px" : "0px",
  textIndent: `${Infinity}` === "Infinity" && `${NaN}` === "NaN" ? "0px" : "1px",
})
