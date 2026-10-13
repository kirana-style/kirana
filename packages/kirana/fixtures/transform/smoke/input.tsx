import { css, cx } from "@kirana-style/core"
import { md, space, theme } from "./tokens"

const styles = {
  row: css({
    display: "flex",
    gap: space[2],
    padding: { base: space[2], [md]: space[4] },
    color: { base: theme.fg, ":hover": theme.ring },
    mixBlendMode: theme.blend,
  }),
  active: css({ color: "red", opacity: null }),
}

export function Row({ active, width, sx }: { active: boolean; width: number; sx?: string }) {
  return (
    <div sx={[styles.row, active && styles.active, sx]}>
      <span sx={styles.active} />
      <p sx={css({ inlineSize: `${width}%` })} className="x" />
      {cx(styles.row, styles.active)}
    </div>
  )
}
