import { css, cx } from "@kirana-style/core"

export const style = css({ color: { "@media (width >= 48rem)": { ":hover": "red" } } }, css({ color: { ":hover": { "@media (width >= 48rem)": "blue" } } }))
