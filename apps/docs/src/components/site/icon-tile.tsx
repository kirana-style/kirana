/**
 * A framed icon: a frosted outer ring around an inset card, the glyph on the
 * card. It is the site's glass in miniature — the same light rim and soft blur
 * as the `Backdrop` pane. `solid` fills the card with the accent and stands
 * beside a section's name (`Eyebrow`); `muted` is the header menus' quiet grey.
 *
 * The card is the ring's `::after`, under the glyph (`isolation` keeps it inside
 * the tile), so the tile is one element. Its corners follow the ring's, less the
 * inset, so the two curves stay concentric.
 */
import { css } from "@kirana-style/core"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { alpha, theme } from "@workspace/ui/theme/semantic"

/** Each size: the tile, the gap to the card, the corner and the glyph. */
const SIZES = {
  sm: {
    tile: "1.5rem",
    inset: "2px",
    radius: "7px",
    inner: "5px",
    glyph: "0.8125rem",
  },
  md: {
    tile: "2.25rem",
    inset: "3px",
    radius: "10px",
    inner: "7px",
    glyph: "1rem",
  },
} as const

const styles = {
  root: css({
    position: "relative",
    isolation: "isolate",
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: alpha.muted50,
    backdropFilter: "blur(8px) saturate(1.3)",
    "::after": {
      content: "''",
      position: "absolute",
      zIndex: -1,
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: theme.border,
      backgroundColor: theme.card,
      boxShadow: `0 1px 2px 0 ${alpha.foreground10}`,
    },
  }),
  sm: css({
    width: SIZES.sm.tile,
    height: SIZES.sm.tile,
    borderRadius: SIZES.sm.radius,
    "::after": { inset: SIZES.sm.inset, borderRadius: SIZES.sm.inner },
  }),
  md: css({
    width: SIZES.md.tile,
    height: SIZES.md.tile,
    borderRadius: SIZES.md.radius,
    "::after": { inset: SIZES.md.inset, borderRadius: SIZES.md.inner },
  }),
  // The glyph in the subtree's accent, or quiet grey where there is none (the header).
  accent: css({ color: accent.base }),
  muted: css({ color: theme.mutedForeground }),
  // The card filled with the accent, the glyph on it in `accent.on` (white, or
  // the background on the neutral accent); the ring a wash of the same accent.
  solid: css({
    color: accent.on,
    borderColor: tint(28),
    backgroundColor: tint(12),
    "::after": {
      borderColor: tint(70),
      backgroundColor: accent.base,
      boxShadow: `inset 0 1px 0 0 rgb(255 255 255 / 0.28), 0 1px 2px 0 ${tint(30)}`,
    },
  }),
}

export function IconTile({
  icon,
  size = "md",
  tone = "accent",
  sx,
}: {
  icon: IconProps["icon"]
  size?: keyof typeof SIZES
  tone?: "accent" | "muted" | "solid"
  sx?: Sx
}) {
  return (
    <span
      data-slot="icon-tile"
      aria-hidden="true"
      sx={[styles.root, styles[size], styles[tone], sx]}
    >
      <Icon icon={icon} size={SIZES[size].glyph} />
    </span>
  )
}
