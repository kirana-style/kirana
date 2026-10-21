import "@kirana-style/core/stylesheet.css"
import { css } from "@kirana-style/core"
import { Switch } from "@kirana-style/states/base-ui"
import { createRoot } from "react-dom/client"

/**
 * The probe the example runner reads back from the browser. Its values are ones no reset or default
 * produces, so seeing them means the compiled stylesheet reached the page.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
  /** A component state as a condition key: the runner checks it applies to an element in that state. */
  state: css({ paddingBottom: { base: "0px", [Switch.Root.checked]: "9px" } }),
}

createRoot(document.getElementById("root")!).render(
  <>
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
    <span data-probe-state="" data-checked="" sx={styles.state} />
  </>
)
