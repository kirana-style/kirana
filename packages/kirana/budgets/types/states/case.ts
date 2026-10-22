// Component states from the generated Base UI vocabulary, used as condition keys.
import { css } from "@kirana-style/core"
import { defineConfig } from "@kirana-style/core/config"
import { Switch as ArkSwitch } from "@kirana-style/states/ark-ui"
import { exclusive, Menu, Select, Switch } from "@kirana-style/states/base-ui"
import { Button as AriaButton } from "@kirana-style/states/react-aria"

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

// The configuration line the guide shows: a vocabulary's exclusive groups are what the key takes.
export const config = defineConfig({ conditions: { exclusive } })
export const others = [AriaButton.focusVisible, ArkSwitch.Root.state.checked]
