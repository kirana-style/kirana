import { css, cx } from "@kirana-style/core"

export const style = css({ "::after": { content: "''", color: "red" }, color: "blue" }, css({ color: null }))
