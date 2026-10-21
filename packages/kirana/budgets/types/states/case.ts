// Component states from the generated Base UI vocabulary, used as condition keys.
import { css } from "@kirana-style/core"
import { Menu, Select, Switch } from "@kirana-style/states/base-ui"

export const track = css({
  backgroundColor: {
    base: "gray",
    [Switch.Root.checked]: { base: "blue", [Switch.Root.disabled]: "silver" },
  },
})

export const popup = css({
  marginTop: { [Select.Popup.side.bottom]: "4px" },
  marginInlineStart: { [Select.Popup.side.inlineEnd]: "4px" },
  opacity: { [Menu.Popup.startingStyle]: 0, [Menu.Popup.endingStyle]: 0 },
})

// @ts-expect-error -- a misspelt state is not in the vocabulary.
export const typo = Switch.Root.chekced
