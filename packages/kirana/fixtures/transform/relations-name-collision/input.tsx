import { css } from "@kirana-style/core"
import { card } from "./a"
import { card as other } from "./b"

const title = css({ color: { [other.within(":hover")]: "red" } })

export function Card() {
  return (
    <article sx={card.anchor}>
      <h2 sx={title} />
    </article>
  )
}
