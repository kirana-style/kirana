/**
 * The name, set in type while the logo is not settled: both words in the serif
 * italic, "kirana" bold and "style" light and muted, as the domain reads. The drawn mark stays in
 * `src/brand` and on the brand page.
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
    fontWeight: fontWeight.bold,
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

export function Wordmark({ sx }: { sx?: Sx }) {
  return (
    <span sx={[styles.root, sx]}>
      <span sx={styles.name}>kirana</span>
      <span sx={styles.style}>style</span>
    </span>
  )
}
