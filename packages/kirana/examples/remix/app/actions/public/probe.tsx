import { css } from "@kirana-style/core"
import { clientEntry } from "remix/component"
import type { Handle } from "remix/component"

/**
 * The probe the example runner reads back from the browser, as a client entry: rendered on the
 * server through `node-tsx`, then hydrated from the asset server. Kirana compiles it after each, so
 * `sx` is a class name in the HTML and stays one after hydration.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export const Probe = clientEntry(
  import.meta.url,
  function Probe(_handle: Handle) {
    return () => (
      <p data-probe="" sx={styles.probe}>
        Styled by Kirana.
      </p>
    )
  }
)
