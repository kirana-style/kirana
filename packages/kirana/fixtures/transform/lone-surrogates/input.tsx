// Strings holding a lone surrogate, which oxc keeps as written since 0.155: none is a CSS value,
// a key, a class or a module specifier, so each is left unevaluated, never mangled.
import { css } from "@kirana-style/core"
import { jsx } from "react/jsx-runtime"
import { lone } from "\uD800"
import Lone from "\uD801"
import { fromReexport, fromStar, namespaced, plain } from "./reexports"

enum Names {
  Plain = "1px",
  "\uD800" = "2px",
}
const keyed = (value: string) => ({ "\uD800": value })
const templated = (value: string) => `\uD800${value}`

export const values = css({
  color: "\uD800",
  content: `\uD800`,
  width: lone,
  height: Names.Plain,
  marginTop: fromReexport,
  marginBottom: namespaced as never,
  paddingTop: fromStar,
  paddingBottom: plain,
})

export const keys = css({ "\uD800": "red" })

export function Dynamic({ size }: { size: string }) {
  return <div sx={css({ width: templated(size), ...keyed(size) })} />
}

export const Elements = () => (
  <>
    <Lone sx={values} />
    {jsx("div", { "\uD800": 1, sx: "\uD800" })}
    {jsx(Lone, { sx: "\uD800" })}
  </>
)
