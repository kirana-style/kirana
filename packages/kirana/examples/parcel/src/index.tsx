import { css } from "@kirana-style/core"
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
}

createRoot(document.getElementById("root")!).render(
  <p data-probe="" sx={styles.probe}>
    Styled by Kirana.
  </p>
)
