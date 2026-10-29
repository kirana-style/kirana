

// A sign-in form anchors its relation and reads a state through it: the read matches only inside
// another form, so the card never dims (KF-066). The state as a condition key is what was meant.
const form = {"name": "form", "anchor": "krg5EP"}
const styles = {
  card: "k87_tIfm k87-kG3N_W8PR k5J-kG3N_Gcl3",
  field: "k87-kG3N_ufrO",
}
export const SignIn = () => (
  <form className="krg5EP k87_tIfm k87-kG3N_W8PR k5J-kG3N_Gcl3">
    <input className="k87-kG3N_ufrO" />
  </form>
)

// A group inside another group reads its own relation with no state: an outer instance (D-101).
const group = {"name": "group", "anchor": "kr5Pg1"}
const nested = "kJ-JCUU_iExv"
export const Group = () => <div className="kr5Pg1 kJ-JCUU_iExv" />
// With a state, as reported as `within`.
const hovered = "k50-2FYt_D9ur"
export const Hovered = () => <div className="kr5Pg1 k50-2FYt_D9ur" />

// After and before on the anchor read the instance beside it, where a state is the usual case (KF-054).
const item = {"name": "item", "anchor": "krGdqo"}
const next = "k9-8clv_oD60"
export const Item = () => <li className="krGdqo k9-8clv_oD60" />
