import { css } from "@kirana-style/core"
import { Parts } from "lib"
import * as Local from "./local"

const root = css({ display: "block" })
export function A() {
  return (
    <>
      <Parts.Deep.Root sx={root} />
      <Local.Thing sx={root} />
      <this.props sx={root} />
    </>
  )
}
