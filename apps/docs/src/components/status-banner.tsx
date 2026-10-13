import { useSyncExternalStore } from "react"
import { css } from "@kirana-style/core"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { DocsLink } from "@/components/docs-link"

import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

const styles = {
  root: css({
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    backgroundColor: alpha.primary10,
    paddingInlineStart: spacing[4],
    paddingInlineEnd: spacing[12],
    paddingBlock: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.foreground,
  }),
  label: css({ fontWeight: fontWeight.semibold }),
  link: css({
    color: theme.foreground,
    textDecorationLine: "underline",
    textUnderlineOffset: "3px",
  }),
  close: css({
    position: "absolute",
    insetInlineEnd: spacing[2],
    insetBlockStart: "50%",
    translate: "0 -50%",
    display: "grid",
    placeItems: "center",
    width: spacing[7],
    height: spacing[7],
    borderRadius: radius.md,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    backgroundColor: { base: "transparent", ":hover": alpha.primary20 },
    cursor: "pointer",
    transitionProperty: "color, background-color",
    transitionDuration: duration[150],
  }),
}

/**
 * Closing the banner is remembered in this browser only. Storage can be
 * unavailable (a private window, blocked site data); then it simply shows
 * again next time.
 */
const KEY = "kirana:status-banner-closed"
const EVENT = "kirana:status-banner"

/** Closed during this visit, for when storage refuses the write. */
let closedHere = false

function closed() {
  if (closedHere) return true
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

/**
 * The status line above the docs. Kirana is not published, and the name is a
 * working name; the docs say so rather than letting a reader find out at
 * `bun add`. The server always renders it; a reader who closed it does not
 * see it again after hydration.
 */
export function StatusBanner() {
  const hidden = useSyncExternalStore(subscribe, closed, () => false)
  if (hidden) return null
  return (
    <div
      sx={styles.root}
      data-slot="status-banner"
      role="region"
      aria-label="Status"
    >
      <span sx={styles.label}>Pre-release.</span>
      <span>
        Kirana is not published to npm yet, and the name is a working name.{" "}
        <DocsLink href="/docs/project/status" sx={styles.link}>
          What works today
        </DocsLink>
        .
      </span>
      <button
        type="button"
        aria-label="Close the notice"
        sx={styles.close}
        onClick={() => {
          closedHere = true
          try {
            localStorage.setItem(KEY, "1")
          } catch {}
          window.dispatchEvent(new Event(EVENT))
        }}
      >
        <Icon icon={Cancel01Icon} size="0.875rem" />
      </button>
    </div>
  )
}
