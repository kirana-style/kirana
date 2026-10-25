import { IconPlaceholder } from "@/registry/lib/kit/icon-placeholder"
import { button } from "@/registry/ui/button.styles"

export function Button({ children }: { children?: React.ReactNode }) {
  return (
    <button data-registry-probe="" sx={button.root}>
      <IconPlaceholder
        lucide="CheckIcon"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="CheckIcon"
        remixicon="RiCheckLine"
      />
      {children}
    </button>
  )
}
