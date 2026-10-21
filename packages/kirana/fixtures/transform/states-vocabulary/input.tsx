import { css, relation } from "@kirana-style/core"
import { Select, Switch } from "@kirana-style/states/base-ui"

import { Dialog } from "./states"

const field = relation("field")

// A state from a vocabulary is a condition key like any other: it nests, combines with other
// conditions and reads through a relation.
export const track = css({
  backgroundColor: {
    base: "gray",
    [Switch.Root.checked]: {
      base: "blue",
      ":hover": "navy",
      // Checked and disabled can hold together, so the nested value says which wins.
      [Switch.Root.disabled]: "silver",
    },
  },
})

export const popup = css({
  marginTop: { [Select.Popup.side.bottom]: "4px" },
  marginBottom: { [Select.Popup.side.top]: "4px" },
})

export const content = css({
  opacity: { base: 1, [Dialog.Content.closed]: 0 },
  scale: { [Dialog.Content.open]: 1, [Dialog.Content.closed]: 0.95 },
})

export const label = css({
  opacity: { base: 1, [field.within(Switch.Root.disabled)]: 0.5 },
})

export function Field() {
  return (
    <label sx={field.anchor}>
      <span sx={label}>Notifications</span>
    </label>
  )
}
