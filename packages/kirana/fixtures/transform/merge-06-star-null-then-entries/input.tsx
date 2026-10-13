import { css, cx } from "@kirana-style/core"

export const style = css({ color: { base: "gray", ":hover": "black" } }, css({ color: { "*": null, base: "blue" } }))
