import { css, relation } from "@kirana-style/core"

const readOnly = relation("readOnly")
export const reader = css({ color: { [readOnly.within()]: "red" } })
