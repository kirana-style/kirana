// Only declares values, but its own compile reports a diagnostic: the bundler loads it to report it.
import { css } from "@kirana-style/core"

export const uncleanColor = "olive"
export const broken = css({ colour: "red" })
