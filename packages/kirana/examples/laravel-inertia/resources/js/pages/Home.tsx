import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser: a page Inertia renders from Laravel's
 * route. Vite compiles it through Kirana's plugin before React's, so `sx` becomes `className`.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export default function Home() {
  return (
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
  )
}
