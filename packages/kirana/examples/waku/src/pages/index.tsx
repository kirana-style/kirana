import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser, in a server component: Waku renders
 * it at build time (`render: "static"`) into `dist/public`, with the class names Kirana compiled.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export default async function Home() {
  return (
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
  )
}

export const getConfig = async () => ({ render: "static" }) as const
