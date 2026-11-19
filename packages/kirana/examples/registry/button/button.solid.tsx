// `ParentProps`, which Solid 1 and Solid 2 both export: Solid 2's `JSX` is `@solidjs/web`'s (KF-129).
import type { ParentProps } from "solid-js"

import { IconPlaceholder } from "@/registry/lib/kit/icon-placeholder"
import { button } from "@/registry/ui/button.styles"

export function Button(props: ParentProps) {
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
