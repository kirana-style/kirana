import { css } from "@kirana-style/core"
import type { Sx } from "@kirana-style/core"

const root = css({
  alignSelf: { base: "stretch", '[data-orientation="vertical"]': "center" },
  color: { ":hover": "red" },
  width: { "[data-size]:hover": "1px" },
})

export function Separator({ sx }: { sx?: Sx }) {
  return <div sx={[root, sx]} />
}
