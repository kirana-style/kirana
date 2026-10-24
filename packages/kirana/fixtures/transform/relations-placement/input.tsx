import { css, relation } from "@kirana-style/core"

const field = relation("field")
const peer = relation("peer")
const unused = relation("unused")

const label = css({ opacity: { [field.within('[data-disabled="true"]')]: 0.5 } })
const hint = css({ display: { base: "none", [peer.after(":checked")]: "block" } })
const before = css({ color: { [peer.before()]: "red" } })
const invalid = css({ color: { [field.within("hover")]: "red" } })
const nonString = css({ color: { [field.within(1 as never)]: "red" } })

export function Good() {
  return (
    <div sx={field.anchor}>
      <label sx={label} />
      <input sx={peer.anchor} />
      <p sx={hint} />
      <span sx={before} />
      <input sx={peer.anchor} />
      <>
        <em sx={label} />
      </>
    </div>
  )
}

export function Bad() {
  return (
    <section>
      {/* Accepted: an element carrying the anchor reads an outer one (KF-018). */}
      <label sx={[label, field.anchor]} />
      <s sx={label} />
      <p sx={hint} />
      <input sx={peer.anchor} />
      <b sx={before} />
      <i render={<span sx={label} />} sx={unused.anchor} />
    </section>
  )
}
export const others = [invalid, nonString, relation(String(Date.now())).name]
