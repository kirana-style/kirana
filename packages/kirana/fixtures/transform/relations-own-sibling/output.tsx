

// A part its caller repeats reads the one beside it: shadcn/ui's `ItemContent` keeps its width
// when it follows another (KF-054).
const content = ({"name": "item-content", "anchor": "krXHtu"})
const step = ({"name": "step", "anchor": "krzZwU"})

const styles = {
  content: "krXHtu k5Y_ k62_sEN7 k64_sEN7 k5Z_vqyP k5Y-KWRB_ k62-KWRB_CSdI k64-KWRB_CSdI k5Z-KWRB_10qz",
  step: "krzZwU kX_KEPB kX-L3Gn_oD60",
  hint: "k50-NlTN_jWjM",
}

export function ItemContent() {
  return <div className="krXHtu k62_sEN7 k64_sEN7 k5Z_vqyP k62-KWRB_CSdI k64-KWRB_CSdI k5Z-KWRB_10qz" />
}

export function Step() {
  return <li className="krzZwU kX_KEPB kX-L3Gn_oD60" />
}

export function Hint() {
  return (
    <ol>
      {/* Still an error: the reader does not carry the anchor, and no earlier sibling does. */}
      <li className="k50-NlTN_jWjM" />
      <li className="krzZwU kX_KEPB kX-L3Gn_oD60" />
    </ol>
  )
}
