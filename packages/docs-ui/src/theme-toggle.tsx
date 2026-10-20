/**
 * The theme control: one button that steps through System, Light and Dark, showing the mode it is
 * in, with `D` to do the same from the keyboard. The site's footer shows it with the mode's name;
 * the docs bar, which has no footer, as an icon (`compact`).
 *
 * The mode's icon and name are chosen in CSS from `<html data-mode>`, as the brand logos are: a
 * prerendered page writes the system mode, and the saved one is on `<html>` before the first paint
 * but in React's state only once the provider has read its cookie, so a label rendered from state
 * would show System first.
 */
import { useEffect } from "react"
import { css } from "@kirana-style/core"
import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { touchTarget } from "@workspace/ui/recipes/touch"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { useTheme } from "@workspace/ui/theme/theme-provider"
import type { Sx } from "@workspace/ui/lib/sx"
import type { ThemeMode } from "@workspace/ui/theme/themes"
import { spacing } from "@workspace/ui/tokens/spacing"

import { schemeMarker } from "./scheme.ts"

const styles = {
  button: css({
    gap: spacing[2],
    borderRadius: radius.full,
    paddingInlineStart: spacing[3],
    paddingInlineEnd: spacing["1.5"],
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),
  // One per mode; the one `<html data-mode>` names shows.
  mode: css({ display: "none", alignItems: "center", gap: spacing[2] }),
  light: css({
    display: { [schemeMarker.within('[data-mode="light"]')]: "inline-flex" },
  }),
  dark: css({
    display: { [schemeMarker.within('[data-mode="dark"]')]: "inline-flex" },
  }),
  system: css({
    display: { [schemeMarker.within('[data-mode="system"]')]: "inline-flex" },
  }),
}

const MODES: {
  value: ThemeMode
  icon: IconProps["icon"]
  label: string
  sx: typeof styles.light
}[] = [
  { value: "system", icon: ComputerIcon, label: "System", sx: styles.system },
  { value: "light", icon: Sun03Icon, label: "Light", sx: styles.light },
  { value: "dark", icon: Moon02Icon, label: "Dark", sx: styles.dark },
]

/** Whether a key press belongs to something the reader is typing in. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  )
}

export function ThemeToggle({
  hotkey = true,
  compact = false,
  sx,
}: {
  /** Whether `D` steps the theme; give it to one toggle per page. */
  hotkey?: boolean
  /** The mode's icon alone, a bar's icon button, without its name or the key. */
  compact?: boolean
  sx?: Sx
}) {
  const { cycleMode } = useTheme()

  useEffect(() => {
    if (!hotkey) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d" || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return
      if (typing(event.target)) return
      event.preventDefault()
      cycleMode()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hotkey, cycleMode])

  if (compact)
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={cycleMode}
        aria-label="Theme: change between system, light and dark"
        title="Change the theme (D)"
        sx={[touchTarget, sx]}
      >
        {MODES.map((mode) => (
          <span key={mode.value} sx={[styles.mode, mode.sx]}>
            <Icon icon={mode.icon} />
          </span>
        ))}
      </Button>
    )

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleMode}
      aria-label="Theme: change between system, light and dark"
      title="Change the theme (D)"
      sx={[touchTarget, styles.button, sx]}
    >
      {MODES.map((mode) => (
        <span key={mode.value} sx={[styles.mode, mode.sx]}>
          <Icon icon={mode.icon} />
          {mode.label}
        </span>
      ))}
      {hotkey ? <Kbd>D</Kbd> : null}
    </Button>
  )
}
