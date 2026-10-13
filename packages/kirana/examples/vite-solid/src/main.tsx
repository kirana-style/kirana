import "@kirana-style/core/stylesheet.css"
import { css } from "@kirana-style/core"
import { render } from "solid-js/web"

/**
 * The probe the example runner reads back from the browser. `jsxImportSource: "solid-js"` in
 * tsconfig.json selects `jsx: "solid"`, so `sx` compiles to `class`; the dynamic margin sends the
 * probe through the runtime, which answers with `class` too.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}
const gap = `${document.title.length % 3}px`

render(
  () => (
    <p data-probe="" sx={[styles.probe, css({ marginLeft: gap })]}>
      Styled by Kirana.
    </p>
  ),
  document.getElementById("root")!
)
