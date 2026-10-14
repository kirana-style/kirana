/**
 * The name, set in type: both words in Newsreader's true italic, "kirana" semibold and "style"
 * light and muted, as the domain reads. It stands beside the drawn mark in the header and the
 * footer; the brand page shows the lockup.
 */
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { fontFamily, fontWeight } from "@workspace/ui/tokens/typography"

const styles = {
  root: css({
    display: "inline-flex",
    alignItems: "baseline",
    gap: "0.3em",
    fontSize: "1.375rem",
    lineHeight: 1,
    color: theme.foreground,
    whiteSpace: "nowrap",
  }),
  name: css({
    fontFamily: fontFamily.serif,
    fontStyle: "italic",
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.01em",
  }),
  style: css({
    fontFamily: fontFamily.serif,
    fontSize: "0.85em",
    fontStyle: "italic",
    fontWeight: fontWeight.light,
    color: theme.mutedForeground,
  }),
}

export function Wordmark({ sx, styleSx }: { sx?: Sx; styleSx?: Sx }) {
  return (
    <span sx={[styles.root, sx]}>
      <span sx={styles.name}>kirana</span>
      <span sx={[styles.style, styleSx]}>style</span>
    </span>
  )
}
