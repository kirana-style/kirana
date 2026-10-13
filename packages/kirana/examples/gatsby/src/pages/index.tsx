import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser. Gatsby renders the page to HTML at
 * build time and hydrates it in the browser; both compile with one Kirana session, so they agree.
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

export const Head = () => <title>Kirana on Gatsby</title>
