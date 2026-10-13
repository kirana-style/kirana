import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser. Meteor builds app code with Rspack,
 * whose configuration carries Kirana's plugin; `sx` becomes `className`.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export const App = () => (
  <p data-probe="" sx={styles.probe}>
    Styled by Kirana.
  </p>
)
