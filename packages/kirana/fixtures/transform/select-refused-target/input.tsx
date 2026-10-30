import { css, select } from "@kirana-style/core"

// A combinator is refused once, as the target: not again as a dynamic key (KF-079).
export const grid = css({
  color: "red",
  [select.descendant(".recharts-cartesian-grid line")]: { strokeOpacity: 1 },
})

export const Grid = () => <div sx={grid} />
