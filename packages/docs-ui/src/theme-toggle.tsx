/**
 * The site footer's theme control: one button that steps through System, Light and Dark, with `D`
 * doing the same from the keyboard (`useThemeHotkey`, shared with `ThemeMenu`). The mode's icon
 * and name are chosen in CSS from `<html data-mode>`: the saved mode is on `<html>` before the
 * first paint but in React's state only once the provider reads its cookie.
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
import { pointer } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { schemeMarker } from "./scheme.ts"

const styles = {
  // A pill with the key in a round chip at its end, inset as the header's "Quick start" chip is:
  // 6px from the top, end and bottom (the 1px border sits outside the padding). On a touch screen
  // both grow to a finger's size, keeping that inset.
  button: css({
    height: { base: spacing[8], [pointer.coarse]: spacing[11] },
    gap: spacing[2],
    borderRadius: radius.full,
    paddingInlineStart: spacing[3],
    paddingInlineEnd: `calc(${spacing["1.5"]} - 1px)`,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),
  key: css({
    width: { base: spacing[5], [pointer.coarse]: spacing[8] },
    height: { base: spacing[5], [pointer.coarse]: spacing[8] },
    paddingInline: 0,
    borderRadius: radius.full,
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

/** `D` steps the theme, unless the reader is typing or holds a modifier. One per page. */
export function useThemeHotkey(enabled = true) {
  const { cycleMode } = useTheme()
  useEffect(() => {
    if (!enabled) return
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
  }, [enabled, cycleMode])
}

export function ThemeToggle({
  hotkey = true,
  sx,
}: {
  /** Whether `D` steps the theme; give it to one toggle per page. */
  hotkey?: boolean
  sx?: Sx
}) {
  const { cycleMode } = useTheme()
  useThemeHotkey(hotkey)

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
      {hotkey ? <Kbd sx={styles.key}>D</Kbd> : null}
    </Button>
  )
}
