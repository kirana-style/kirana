import { css } from "@kirana-style/core"

const root = css({
  alignSelf: { base: "stretch", '[data-orientation="vertical"]': "center" },
})

export function Separator({ sx }) {
  return <div sx={[root, sx]} />
}
