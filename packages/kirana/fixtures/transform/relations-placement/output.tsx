

const field = ({"name": "field", "anchor": "krLW1F"})
const peer = ({"name": "peer", "anchor": "krzJXH"})
const unused = ({"name": "unused", "anchor": "krpkAj"})

const label = "k88-soRz_ufrO"
const hint = "k5P_Im6t k5P-krb5_u3uh"
const before = "k50-6nuf_D9ur"
const invalid = ""
const nonString = ""

export function Good() {
  return (
    <div className="krLW1F">
      <label className="k88-soRz_ufrO" />
      <input className="krzJXH" />
      <p className="k5P_Im6t k5P-krb5_u3uh" />
      <span className="k50-6nuf_D9ur" />
      <input className="krzJXH" />
      <>
        <em className="k88-soRz_ufrO" />
      </>
    </div>
  )
}

export function Bad() {
  return (
    <section>
      {/* Accepted: an element carrying the anchor reads an outer one (KF-018). */}
      <label className="krLW1F k88-soRz_ufrO" />
      <s className="k88-soRz_ufrO" />
      <p className="k5P_Im6t k5P-krb5_u3uh" />
      <input className="krzJXH" />
      <b className="k50-6nuf_D9ur" />
      <i render={<span className="k88-soRz_ufrO" />} className="krpkAj" />
    </section>
  )
}
export const others = [invalid, nonString, undefined.name]
