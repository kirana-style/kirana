import { css, props as styleProps } from "@kirana-style/core"

const styles = {
  root: css({ color: "red", display: "grid", width: 5 }),
  unused: css({}),
}

export function Card({ sx }) {
  return (
    <div sx={[sx, styles.root]}>
      <span className="x" {...styleProps(styles.root)} />
    </div>
  )
}
