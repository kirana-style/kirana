import { css, props as styleProps } from "@kirana-style/core"

const box = css({ display: "grid", color: { base: "black", ":hover": "red" } })
const wide = css({ width: "100%" })

// Preact: `sx` compiles to `class`, and a `className` the element already has joins it.
export function A({ on, w, rest }: { on: boolean; w: number; rest: object }) {
  return (
    <>
      <div sx={box} />
      <div class="own" sx={box} />
      <div className="legacy" sx={[box, on && wide]} />
      <div style={{ opacity: 1 }} sx={css({ width: w })} />
      <div {...rest} sx={box} />
      <input {...styleProps(box)} />
    </>
  )
}
