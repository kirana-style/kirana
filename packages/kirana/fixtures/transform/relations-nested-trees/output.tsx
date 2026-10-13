

const card = {"name": "card", "anchor": "krvwJq"}
const title = "k50-CIDc_D9ur"

export function Outer({ children }: { children: React.ReactNode }) {
  return (
    <section>
      {children}
      <article className="krvwJq">
        {[1, 2].map((n) => (
          <h2 key={n} className="k50-CIDc_D9ur" />
        ))}
        <Inner label={<h3 className="k50-CIDc_D9ur" />} />
      </article>
      <h4 className="k50-CIDc_D9ur" />
    </section>
  )
}
function Inner({ label }: { label: React.ReactNode }) {
  return <div className="krvwJq">{label}</div>
}
