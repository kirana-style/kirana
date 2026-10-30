import { css, select } from "@kirana-style/core"

// A library's class is the only hook its markup offers (KF-079): TanStack Charts' grid.
export const chart = css({
  [select.descendant(".ts-chart__grid")]: { strokeOpacity: 1 },
  // An element, classes and a pseudo-class: one compound selector.
  [select.child("svg.ts-chart.ts-chart--line:hover")]: { opacity: 0.8 },
  [select.descendant("g.ts-chart__series:not(.ts-chart__series--muted)")]: { strokeWidth: 2 },
})

export const Chart = () => <div sx={chart} />
