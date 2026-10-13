

const field = {"name": "field", "anchor": "krLW1F"}
const peer = {"name": "peer", "anchor": "krzJXH"}
const unused = {"name": "unused", "anchor": "krpkAj"}

const label = "k87-soRz_ufrO"
const hint = "k5O_Im6t k5O-krb5_u3uh"
const before = "k50-6nuf_D9ur"
const invalid = ""
const nonString = ""

export function Good() {
  return (
    <div className="krLW1F">
      <label className="k87-soRz_ufrO" />
      <input className="krzJXH" />
      <p className="k5O_Im6t k5O-krb5_u3uh" />
      <span className="k50-6nuf_D9ur" />
      <input className="krzJXH" />
      <>
        <em className="k87-soRz_ufrO" />
      </>
    </div>
  )
}

export function Bad() {
  return (
    <section>
      <label className="krLW1F k87-soRz_ufrO" />
      <p className="k5O_Im6t k5O-krb5_u3uh" />
      <input className="krzJXH" />
      <b className="k50-6nuf_D9ur" />
      <i render={<span className="k87-soRz_ufrO" />} className="krpkAj" />
    </section>
  )
}
export const others = [invalid, nonString, undefined.name]
