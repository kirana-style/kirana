import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Icon } from "@workspace/ui/primitives"
import { VisuallyHidden } from "@workspace/ui/primitives/visually-hidden"
import type { ThemeMode } from "@workspace/ui/theme/themes"
import { useTheme } from "@workspace/ui/theme/theme-provider"
import { touchTarget } from "@workspace/ui/recipes/touch"

const MODES: { value: ThemeMode; icon: typeof Sun03Icon; label: string }[] = [
  { value: "system", icon: ComputerIcon, label: "Follow system" },
  { value: "light", icon: Sun03Icon, label: "Light" },
  { value: "dark", icon: Moon02Icon, label: "Dark" },
]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()

  return (
    <ToggleGroup
      spacing={0}
      variant="outline"
      size="sm"
      value={[mode]}
      onValueChange={(value) => {
        const next = value[0] as ThemeMode | undefined
        if (next) setMode(next)
      }}
      aria-label="Colour scheme"
    >
      {MODES.map(({ value, icon, label }) => (
        <ToggleGroupItem key={value} value={value} sx={touchTarget}>
          <Icon icon={icon} strokeWidth={2} />
          <VisuallyHidden>{label}</VisuallyHidden>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
