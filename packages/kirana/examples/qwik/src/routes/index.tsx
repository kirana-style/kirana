import { css } from "@kirana-style/core"
import { component$, useSignal } from "@qwik.dev/core"

/**
 * The probe the example runner reads back from the browser. `jsxImportSource: "@qwik.dev/core"` in
 * tsconfig.json selects `jsx: "qwik"`, so `sx` compiles to `class`. The page is rendered on the
 * server and resumed in the browser; the dynamic margin sends the probe through the runtime, which
 * answers with `class` too. The handles are module constants, which the optimizer's `$` segments
 * import.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export default component$(() => {
  const gap = useSignal("1px")
  return (
    <p data-probe="" sx={[styles.probe, css({ marginLeft: gap.value })]}>
      Styled by Kirana.
    </p>
  )
})
