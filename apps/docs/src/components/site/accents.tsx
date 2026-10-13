/**
 * Small pieces that carry a section's accent: the keycap glyph beside a
 * section's name, the eyebrow that pairs it with a label, and the gradient band
 * a page ends on.
 */
import { css } from "@kirana-style/core"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

const styles = {
  // A key: a darker base one pixel deeper at the bottom, the accent face on top.
  keycap: css({
    display: "inline-grid",
    flexShrink: 0,
    justifySelf: "start",
    borderRadius: "5px",
    padding: "1px",
    paddingBlockEnd: "2px",
    backgroundColor: `color-mix(in oklab, ${accent.base} 72%, black)`,
  }),
  keycapFace: css({
    display: "grid",
    placeItems: "center",
    width: "1.125rem",
    height: "1.125rem",
    borderRadius: "4px",
    backgroundColor: accent.base,
    color: accent.on,
    boxShadow: "inset 0 0.5px 0 0 rgb(255 255 255 / 0.45)",
  }),
  eyebrow: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
  }),

  band: css({
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gap: spacing[6],
    alignItems: "center",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) auto",
    },
    paddingInline: { base: spacing[6], [breakpoint.md]: spacing[12] },
    paddingBlock: { base: spacing[10], [breakpoint.md]: spacing[14] },
    backgroundColor: theme.background,
  }),
  bandGlow: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `radial-gradient(110% 160% at 82% 100%, ${tint(22)} 0%, transparent 62%), radial-gradient(90% 140% at 6% 0%, ${tint(12)} 0%, transparent 60%)`,
  }),
  bandLines: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(-45deg, transparent 0 3px, ${tint(14)} 3px 3.55px)`,
    maskImage:
      "radial-gradient(85% 95% at 88% 110%, black 0%, transparent 68%), radial-gradient(70% 90% at 4% -5%, black 0%, transparent 62%)",
  }),
  bandCopy: css({ position: "relative", display: "grid", gap: spacing[2] }),
  bandTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize.xl, [breakpoint.md]: fontSize["2xl"] },
    lineHeight: { base: lineHeight.xl, [breakpoint.md]: lineHeight["2xl"] },
    fontWeight: fontWeight.bold,
  }),
  bandText: css({
    maxWidth: "34rem",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  bandActions: css({
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[3],
  }),
}

export function Keycap({ icon }: { icon: IconProps["icon"] }) {
  return (
    <span sx={styles.keycap} aria-hidden="true">
      <span sx={styles.keycapFace}>
        <Icon icon={icon} size="0.75rem" />
      </span>
    </span>
  )
}

/** The accent keycap and a label: what sits above a section's title. */
export function Eyebrow({
  icon,
  children,
  sx,
}: {
  icon: IconProps["icon"]
  children: React.ReactNode
  sx?: Sx
}) {
  return (
    <span sx={[styles.eyebrow, sx]}>
      <Keycap icon={icon} />
      {children}
    </span>
  )
}

/** The strip a page ends on: two accent glows and hatching fading from two corners. */
export function GlowBand({
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
      <div sx={styles.bandGlow} aria-hidden="true" />
      <div sx={styles.bandLines} aria-hidden="true" />
      <div sx={styles.bandCopy}>
        <h2 sx={styles.bandTitle}>{title}</h2>
        {children ? <p sx={styles.bandText}>{children}</p> : null}
      </div>
      {actions ? <div sx={styles.bandActions}>{actions}</div> : null}
    </div>
  )
}
