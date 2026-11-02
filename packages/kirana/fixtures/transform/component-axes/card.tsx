import { css } from "@kirana-style/core"
import type { Sx } from "@kirana-style/core"

const styles = {
  root: css({ display: "flex", paddingTop: "16px", paddingBottom: "16px", paddingInline: "24px" }),
}

// Card's own styles, then the caller's `sx`, on its root element.
export function Card({ sx, children }: { sx?: Sx; children?: unknown }) {
  return <div sx={[styles.root, sx]}>{children as never}</div>
}

// The same through an arrow, and one whose root styles are only known at runtime.
export const Panel = ({ sx }: { sx?: Sx }) => <section sx={[styles.root, sx]} />
export const Loose = ({ sx, tone }: { sx?: Sx; tone: Sx }) => <aside sx={[tone, sx]} />

// A logical side of its own, one longhand that wins over a caller's whole `padding`; its first element
// takes `sx` with no value, so the root is the next.
const inset = css({ paddingInlineStart: "8px" })
export function Inset({ sx }: { sx?: Sx }) {
  return (
    <b sx>
      <i sx={[inset, sx]} />
    </b>
  )
}
