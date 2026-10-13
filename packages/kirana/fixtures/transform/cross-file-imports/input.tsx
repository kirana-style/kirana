import boxDefault, { box, helper } from "./styles"
import { nothing } from "./broken"
import { missingFile } from "./does-not-exist"
import { css } from "@kirana-style/core"

export const merged = css(box, boxDefault, { color: nothing ?? missingFile ?? "green" })
export const value = helper()
