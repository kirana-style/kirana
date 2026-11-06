import type { JSX } from "solid-js"

import { IconPlaceholder } from "@/registry/lib/kit/icon-placeholder"
import { button } from "@/registry/ui/button.styles"

export function Button(props: { children?: JSX.Element }) {
  return (
    <button data-registry-probe="" sx={button.root}>
      <IconPlaceholder
        lucide="CheckIcon"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="CheckIcon"
        remixicon="RiCheckLine"
      />
      {props.children}
    </button>
  )
}
