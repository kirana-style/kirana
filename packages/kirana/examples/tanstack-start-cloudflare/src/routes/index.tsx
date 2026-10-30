import { useState } from "react"
import { css } from "@kirana-style/core"
import { space } from "@kirana-style/preset-scales"
import { createFileRoute } from "@tanstack/react-router"

/**
 * The probe the example runner reads back from the browser. The server half renders inside workerd,
 * which pre-bundles its own dependencies, so this page uses the two things that must reach it
 * compiled on a cold first request (KF-001): a style merged at runtime, which imports Kirana's
 * runtime, and a preset's tokens read at runtime (`steps`), whose `defineTokens()` throws if the
 * preset was pre-bundled instead of compiled.
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
