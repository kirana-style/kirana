/**
 * The bar's theme control: one icon button, the sun or the moon the page is showing, that opens
 * Light, Dark and Follow the system. One button of the bar's own size in place of a row of
 * segmented toggles, on the site and in the docs.
 */
import { css } from "@kirana-style/core"
import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { touchTarget } from "@workspace/ui/recipes/touch"
import { useTheme } from "@workspace/ui/theme/theme-provider"
import type { ThemeMode } from "@workspace/ui/theme/themes"
import { spacing } from "@workspace/ui/tokens/spacing"

import { schemeMarker } from "./scheme.ts"

const prefersDark = "@media (prefers-color-scheme: dark)"
const dark = '[data-mode="dark"]'
const system = '[data-mode="system"]'

const styles = {
  // The trigger shows the scheme on screen: `schemeMarker` carries the mode, and `system`
  // follows the OS, as the brand logos do.
  sun: css({
    display: {
      base: "inline-flex",
      [schemeMarker.within(dark)]: "none",
      [schemeMarker.within(system)]: { [prefersDark]: "none" },
    },
  }),
  moon: css({
    display: {
      base: "none",
      [schemeMarker.within(dark)]: "inline-flex",
      [schemeMarker.within(system)]: { [prefersDark]: "inline-flex" },
    },
  }),
  menu: css({ width: "auto", minWidth: "12rem" }),
  item: css({ gap: spacing[2] }),
}

const SCHEMES: { value: ThemeMode; icon: IconProps["icon"]; label: string }[] =
  [
    { value: "light", icon: Sun03Icon, label: "Light" },
    { value: "dark", icon: Moon02Icon, label: "Dark" },
    { value: "system", icon: ComputerIcon, label: "System" },
  ]

export function ThemeMenu() {
  const { mode, setMode } = useTheme()
  const label = "Theme"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            sx={touchTarget}
          />
        }
      >
        <Icon icon={Sun03Icon} sx={styles.sun} />
        <Icon icon={Moon02Icon} sx={styles.moon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sx={styles.menu}>
        {/* A label must sit inside its group, or Base UI throws when the menu opens. */}
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as ThemeMode)}
        >
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {SCHEMES.map((scheme) => (
            <DropdownMenuRadioItem
              key={scheme.value}
              value={scheme.value}
              sx={styles.item}
            >
              <Icon icon={scheme.icon} />
              {scheme.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
