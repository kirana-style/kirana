import { css } from "@kirana-style/core"

import { panel } from "./relations"

// The anchor is applied where the panel renders, in a module this build never compiles.
export const reader = css({ color: { [panel.within()]: "red" } })
