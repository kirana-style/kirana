import cssDefault, { css, mode, select } from "@kirana-style/core"
import * as kirana from "@kirana-style/core"
import { unknownExport } from "@kirana-style/core"

const alias = css
export const called = select("svg")
export const moded = mode()
export const stringArgument = css("color: red")
export const namespaced = kirana.css({ color: "red" })
export const other = [cssDefault, unknownExport, alias]
