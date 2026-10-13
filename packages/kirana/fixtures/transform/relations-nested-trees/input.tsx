import { css, relation } from "@kirana-style/core"

const card = relation("card")
const title = css({ color: { [card.within()]: "red" } })

export function Outer({ children }: { children: React.ReactNode }) {
  return (
    <section>
      {children}
      <article sx={card.anchor}>
        {[1, 2].map((n) => (
          <h2 key={n} sx={title} />
        ))}
        <Inner label={<h3 sx={title} />} />
      </article>
      <h4 sx={title} />
    </section>
  )
}
function Inner({ label }: { label: React.ReactNode }) {
  return <div sx={card.anchor}>{label}</div>
}
