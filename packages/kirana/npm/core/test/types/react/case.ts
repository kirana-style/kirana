// No type entry, as in a React app: `props()` gives `className`.
import { css, props } from "@kirana-style/core"

const root = css({ color: "red" })
export const own: string | undefined = props(root).className
// @ts-expect-error React takes `className`; `props()` gives no `class`
export const other = props(root).class
