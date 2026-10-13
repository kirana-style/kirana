import { css, props as styleProps } from "@kirana-style/core"

const box = css({ display: "grid" })

// Solid: `sx` compiles to `class`; dynamic values bridge through custom properties, which Solid's
// style object sets as written.
export function A(props: { w: number; on: boolean }) {
  return (
    <>
      <div sx={box} />
      <div class="own" sx={[box, props.on && css({ opacity: 0.5 })]} />
      <div sx={css({ width: props.w })} />
      <div {...styleProps(box)} />
    </>
  )
}
