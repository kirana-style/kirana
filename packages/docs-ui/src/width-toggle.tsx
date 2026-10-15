/**
 * The page width, beside "Copy page": a button the size of that one, filled in the page's hue while
 * the page fills the column, so the state is on screen. It shows from xl up, where the column has
 * room to give; the choice is kept in `preferences.ts`.
 */
import { useSyncExternalStore } from "react"
import { css } from "@kirana-style/core"
import { MoveHorizontalIcon } from "@hugeicons/core-free-icons"

import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"

import { accent, tint } from "./accent.ts"
import { widePreference } from "./preferences.ts"

const styles = {
  button: css({
    display: { base: "none", [breakpoint.xl]: "inline-grid" },
    placeItems: "center",
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, '[aria-pressed="true"]': tint(45) },
    backgroundColor: {
      base: theme.background,
      ":hover": alpha.muted50,
      '[aria-pressed="true"]': tint(12),
    },
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      '[aria-pressed="true"]': accent.base,
    },
    cursor: "pointer",
    transitionProperty: "background-color, border-color, color",
    transitionDuration: duration[150],
  }),
}

export function WidthToggle() {
  const wide = useSyncExternalStore(
    widePreference.subscribe,
    widePreference.read,
    () => false
  )
  const label = wide ? "Full width: on" : "Full width: off"
  return (
    <button
      type="button"
      sx={styles.button}
      aria-pressed={wide}
      aria-label="Full width"
      title={label}
      onClick={() => widePreference.write(!wide)}
    >
      <Icon icon={MoveHorizontalIcon} size="1rem" />
    </button>
  )
}
