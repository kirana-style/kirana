import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser, rendered by a server component: its
 * classes are plain strings in the HTML, and the stylesheet is Next's own CSS asset.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export default function Page() {
  return (
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
  )
}
