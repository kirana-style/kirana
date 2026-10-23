import { useState } from "react"
import { css } from "@kirana-style/core"
import { space } from "@kirana-style/preset-scales"
import { createFileRoute } from "@tanstack/react-router"

/**
 * The probe the example runner reads back from the browser. The server half renders inside workerd
 * (Cloudflare's Vite plugin), which pre-bundles its own dependencies, so this page uses the two
 * things that reached it wrong in 0.3.1 (KF-001), from a cold cache, on the first request:
 *
 * - a style merged at runtime (`sx` with a value chosen by state), which imports Kirana's runtime
 *   into the compiled module;
 * - a preset's token object read at runtime (`steps`), which loads `@kirana-style/preset-scales`
 *   on the server: pre-bundled instead of compiled, its `defineTokens()` throws.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    marginBottom: space[2],
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
  pressed: css({ outlineStyle: "solid" }),
}

const steps = Object.keys(space).length

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const [pressed, setPressed] = useState(false)
  return (
    <p
      data-probe=""
      data-steps={steps}
      onClick={() => setPressed(!pressed)}
      sx={[styles.probe, pressed && styles.pressed]}
    >
      Styled by Kirana.
    </p>
  )
}
