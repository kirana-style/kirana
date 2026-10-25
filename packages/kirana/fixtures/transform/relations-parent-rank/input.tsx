import { css, relation } from "@kirana-style/core"

const ui = relation("ui")
const group = relation("field-group")

// kirana-ui's FieldGroup: Vega's wider gap, and a group directly inside another tighter. The parent
// read ranks with the pseudo-classes, as the `:where([data-slot] > *)` it replaces did, so it wins
// over the style's relation read without an ambiguous-precedence warning.
export const fieldGroup = css(group.anchor, {
  gap: { base: "1.75rem", [ui.within('[data-style="vega"]')]: "2rem", [group.parent()]: "1rem" },
})

export const App = () => (
  <div sx={ui.anchor}>
    <div sx={fieldGroup}>
      <div sx={fieldGroup} />
    </div>
  </div>
)
