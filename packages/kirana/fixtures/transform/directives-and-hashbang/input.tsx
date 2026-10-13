"use client"
"use strict"

import { css } from "@kirana-style/core"

export function Client({ width }: { width: number }) {
  return <div sx={css({ width: `${width}px` })} />
}
