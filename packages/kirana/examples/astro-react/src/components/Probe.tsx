import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser: a React island, rendered on the server
 * and hydrated with `client:load`. Kirana compiles the island before React does, so `sx` becomes
 * `className` in both.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export default function Probe() {
  return (
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
  )
}
