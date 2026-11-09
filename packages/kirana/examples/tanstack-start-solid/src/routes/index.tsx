import { css } from "@kirana-style/core"
import { createFileRoute } from "@tanstack/solid-router"

/**
 * The probe the example runner reads back from the browser. TanStack Start compiles routes with
 * Vite, so Kirana's plugin compiles them first; `sx` becomes `class`, as Solid spells it, on the
 * server render and after hydration alike.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
  )
}
