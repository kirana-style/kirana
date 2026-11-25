import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");

import { Primitive, Namespace } from "headless"


const root = "k5P_23ai"
const empty = "k50*_"

function Card({ sx, ...props }: { sx?: string }) {
  return <div {...props} {...__k.sx(["k5P_23ai", (sx)], [(props)?.className], [(props)?.style])} />
}

export function Elements(props: { className?: string; style?: object }) {
  return (
    <>
      <div className="k5P_23ai" />
      <div  />
      <div {...__k.sx(["k5P_23ai"], ["a"], [({ color: "red" })])} />
      <div data-x="1" {...__k.sx(["k5P_23ai"], [(props.className)], [(props.style)])} />
      <div {...props} {...__k.sx(["k5P_23ai"], [(props)?.className, "late"], [(props)?.style])} />
      <svg className="k5U_D9ur" />
      <my-element className="k5P_23ai" />
      <x:el className="k5P_23ai" />
      <Card sx={root} />
      <Card sx="padding-4" />
      <div sx="padding-4" />
      <div  />
      <div  />
      <div  />
      <Primitive sx={root} />
      <Namespace.Root sx={root} />
      <div  />
      <div className="only" />
      <div {...__k.sx(["k5P_23ai"], [], [("color: red" as never)])} />
      <div {...__k.sx(["k5P_23ai"], [("b")], ["color: red"])} />
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
