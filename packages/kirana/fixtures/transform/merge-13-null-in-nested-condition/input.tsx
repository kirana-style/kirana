import { css, cx } from "@kirana-style/core"

export const style = css({ color: { ":hover": { base: "red", "@media (width >= 48rem)": "blue" } } }, css({ color: { ":hover": { "@media (width >= 48rem)": null } } }))
