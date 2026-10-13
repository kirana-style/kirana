import { css } from "@kirana-style/core"

export const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export function Probe({ wide }: { wide: boolean }) {
  return (
    <p data-probe="" sx={[styles.probe, wide && css({ width: "100%" })]}>
      Styled by Kirana.
    </p>
  )
}
