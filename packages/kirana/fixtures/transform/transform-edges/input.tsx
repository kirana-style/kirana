import { css, relation } from "@kirana-style/core"
import { Thing } from "lib"

const root = css({ display: "block" })
const panel = relation("panel")
const reader = css({ color: { [panel.within()]: "red" } })
const factory = () => () => root

function Wrapper({ sx }: { sx?: unknown }) {
  return <section sx={sx as never} />
}

export function A() {
  return (
    <>
      <svg xlink:href="#icon" sx={root} />
      <this sx={root} />
      <Wrapper sx={panel.anchor} />
      <Thing.missing sx={root} />
      <p sx={reader} />
      {factory()()}
    </>
  )
}
