import { css } from "@kirana-style/core"
import Layout from "@theme/Layout"

/**
 * The probe the example runner reads back from the browser, on a Docusaurus page in the theme's
 * layout. `sx` becomes `className` in the server render and after hydration alike.
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
    <Layout title="Kirana">
      <main>
        <p data-probe="" sx={styles.probe}>
          Styled by Kirana.
        </p>
      </main>
    </Layout>
  )
}
