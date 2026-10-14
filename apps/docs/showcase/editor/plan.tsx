import { css } from "@kirana-style/core"
import { color, md, space } from "./tokens"

const card = css({
  display: "grid",
  gap: space[4],
  padding: { base: space[4], [md]: space[6] },
  borderColor: color.brand,
})

const title = css({ fontSize: "1.25rem", fontWeight: 600, color: color.ink })

export const Plan = () => (
  <article sx={card}>
    <h2 sx={title}>Pro</h2>
  </article>
)
