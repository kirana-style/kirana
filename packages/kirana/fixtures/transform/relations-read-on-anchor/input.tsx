import { css, relation } from "@kirana-style/core"

// A sign-in form anchors its relation and reads a state through it: the read matches only inside
// another form, so the card never dims (KF-066). The state as a condition key is what was meant.
const form = relation("form")
const styles = {
  card: css({
    opacity: { base: 1, [form.within('[data-disabled="true"]')]: 0.55 },
    cursor: { [form.within('[data-disabled="true"]')]: "not-allowed" },
  }),
  field: css({ opacity: { [form.within('[data-disabled="true"]')]: 0.5 } }),
}
export const SignIn = () => (
  <form sx={[form.anchor, styles.card]}>
    <input sx={styles.field} />
  </form>
)

// A group inside another group reads its own relation with no state: an outer instance (D-101).
const group = relation("group")
const nested = css({ gap: { [group.parent()]: "1rem" } })
export const Group = () => <div sx={[group.anchor, nested]} />
// With a state, as reported as `within`.
const hovered = css({ color: { [group.parent(":hover")]: "red" } })
export const Hovered = () => <div sx={[group.anchor, hovered]} />

// After and before on the anchor read the instance beside it, where a state is the usual case (KF-054).
const item = relation("item")
const next = css({ marginTop: { [item.after("[data-open]")]: "0" } })
export const Item = () => <li sx={[item.anchor, next]} />
