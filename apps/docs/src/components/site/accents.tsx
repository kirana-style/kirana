/**
 * Small pieces that carry a page's hue: the framed glyph (`Keycap`), the label that names a part
 * of a page (`Eyebrow`), and the strip a page ends on (`NextStep`).
 */
import { css } from "@kirana-style/core"

import { accent } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { IconTile } from "./icon-tile"

const styles = {
  eyebrow: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["2.5"],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.foreground,
  }),
  pixel: css({
    width: "0.5rem",
    height: "0.5rem",
    flexShrink: 0,
    backgroundColor: accent.base,
  }),

  band: css({
    display: "grid",
    gap: spacing[6],
    alignItems: "center",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) auto",
    },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[12], [breakpoint.md]: spacing[16] },
  }),
  bandCopy: css({ display: "grid", gap: spacing[3] }),
  bandTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.heading,
    lineHeight: textLeading.heading,
    letterSpacing: textTracking.heading,
    fontWeight: fontWeight.normal,
    textWrap: "balance",
  }),
  bandText: css({
    maxWidth: "36rem",
    fontSize: fontSize.base,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  bandActions: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
}

/** A glyph in a framed tile, filled with the subtree's hue. */
export function Keycap({ icon }: { icon: IconProps["icon"] }) {
  return <IconTile icon={icon} tone="solid" />
}

/**
 * The name of a part of a page, in small mono capitals after one pixel of the page's hue. It names
 * what the heading under it is about; it is not a badge, and it never repeats the heading.
 */
export function Eyebrow({
  children,
  sx,
}: {
  children: React.ReactNode
  sx?: Sx
}) {
  return (
    <span sx={[styles.eyebrow, sx]}>
      <span sx={styles.pixel} aria-hidden="true" />
      {children}
    </span>
  )
}

/** The strip a page ends on: one line in the serif, a sentence, and where to go next. */
export function NextStep({
  title,
  children,
  actions,
  sx,
}: {
  title: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
  sx?: Sx
}) {
  return (
    <div sx={[styles.band, sx]}>
      <div sx={styles.bandCopy}>
        <h2 sx={styles.bandTitle}>{title}</h2>
        {children ? <p sx={styles.bandText}>{children}</p> : null}
      </div>
      {actions ? <div sx={styles.bandActions}>{actions}</div> : null}
    </div>
  )
}
