import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the story's frame. Storybook builds stories with
 * the project's Vite config, so Kirana's plugin compiles them; `sx` becomes `className`.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export function Probe() {
  return (
    <p data-probe="" sx={styles.probe}>
      Styled by Kirana.
    </p>
  )
}
