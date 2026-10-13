import { component$, useSignal } from "@qwik.dev/core"
import { css, props as styleProps } from "@kirana-style/core"

const box = css({ display: "grid" })

// Qwik: `sx` compiles to `class`; dynamic values bridge through custom properties in Qwik's style
// object, and the handles stay module-level constants the optimizer's `$` segments import.
export const A = component$((props: { w: number }) => {
  const on = useSignal(false)
  return (
    <>
      <div sx={box} />
      <div class="own" sx={[box, on.value && css({ opacity: 0.5 })]} />
      <div sx={css({ width: props.w })} />
      <div {...styleProps(box)} />
    </>
  )
})
