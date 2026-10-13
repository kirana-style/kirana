import { css } from "@kirana-style/core"
import { Primitive, Namespace } from "headless"
import { unused } from "./external"

const root = css({ display: "flex" })
const empty = css({ color: null })

function Card({ sx, ...props }: { sx?: string }) {
  return <div {...props} sx={[root, sx]} />
}

export function Elements(props: { className?: string; style?: object }) {
  return (
    <>
      <div sx={root} />
      <div sx={empty} />
      <div className="a" sx={root} style={{ color: "red" }} />
      <div className={props.className} sx={root} style={props.style} data-x="1" />
      <div {...props} sx={root} className="late" />
      <svg sx={css({ fill: "red" })} />
      <my-element sx={root} />
      <x:el sx={root} />
      <Card sx={root} />
      <Card sx="padding-4" />
      <div sx="padding-4" />
      <div sx={"padding-4"} />
      <div sx={{ color: "red" }} />
      <div sx={3} />
      <Primitive sx={root} />
      <Namespace.Root sx={root} />
      <div sx={unused} />
      <div className="only" />
      <div sx={root} style={"color: red" as never} />
      <div sx={root} className={"b"} style="color: red" />
    </>
  )
}

export function Unused({ sx, ...rest }: { sx?: string }) {
  return <div {...rest} />
}
export function Destructured() {
  const { sx } = { sx: 1 }
  return sx
}
