// `@kirana-style/core/preact` registers `class`, the key `props()` compiles to there (KF-047).
import { css, props } from "@kirana-style/core"

const root = css({ color: "red" })
export const own: string | undefined = props(root).class
// @ts-expect-error the compiled object has no `className`, so reading it is `undefined`
export const other = props(root).className
