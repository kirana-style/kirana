import { css, relation } from "@kirana-style/core"
const lonely = relation("lonely")
export function A({ w }: { w: number }) {
  return <div sx={[lonely.anchor, css({ color: "light-dark(white, black)", width: `${w}px`, padding: "var(--x)" })]} />
}
