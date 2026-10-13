import { css, relation } from "@kirana-style/core"
const group = relation("group")
export const ambiguous = css({
  color: { "[data-state=\"open\"]": "red", "[aria-expanded=\"true\"]": "blue", "[data-state=\"closed\"]": "green" },
  opacity: { [group.within('[data-size="sm"]')]: 0.5, [group.within('[data-size="lg"]')]: 1 },
  paddingInlineStart: "1rem",
  paddingLeft: "2rem",
  // Written later, but the earlier longhand sets fewer longhands and wins: reported.
  marginInlineEnd: "1rem",
  margin: "2px",
  // Written later, but the earlier physical longhand sets fewer longhands and wins: reported.
  paddingTop: "1px",
  paddingBlock: "2px",
})
export function A() { return <div sx={group.anchor}><p sx={ambiguous} /></div> }
