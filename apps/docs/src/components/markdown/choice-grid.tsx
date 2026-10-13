/**
 * A grid of choices with logos — frameworks, editors, linters: each a card with the logo, its
 * name, how it is used, and an arrow, linking to its guide or section. `tiles` is the guide grid
 * of the "Get started" page: a larger logo, and a line that wraps instead of being cut.
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon, PackageIcon } from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { LogoIcon } from "@/components/site/brands"
import { LIFT, REST } from "@/components/site/lift"
import type { Logo } from "@/components/site/brands"

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[2],
    marginBlockEnd: spacing[6],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(var(--columns, 3), minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    paddingInline: spacing[3],
    paddingBlock: spacing[3],
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow, border-color, background-color",
    transitionDuration: duration[150],
  }),
  wide: css({ gridColumn: { base: "auto", [breakpoint.sm]: "1 / -1" } }),
  // Tailwind's guide tiles: no frame until hovered, so the line has the room.
  tiles: css({ gap: { base: spacing[1], [breakpoint.sm]: spacing[2] } }),
  tile: css({
    alignItems: "flex-start",
    gap: spacing["3.5"],
    borderColor: { base: "transparent", ":hover": theme.border },
    backgroundColor: { base: "transparent", ":hover": tint(4) },
    paddingBlock: spacing[3],
    paddingInline: spacing[2],
  }),
  tileLogo: css({
    width: spacing[11],
    height: spacing[11],
    borderRadius: radius.full,
  }),
  tileHow: css({
    overflow: "visible",
    whiteSpace: "normal",
    textWrap: "pretty",
    lineHeight: "1.5",
  }),
  tileText: css({ gap: spacing[1], paddingBlockStart: "2px" }),

  logo: css({
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  text: css({ display: "grid", gap: "1px", minWidth: 0, flex: 1 }),
  title: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  how: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  logos: css({ display: "flex", gap: spacing["1.5"], color: theme.foreground }),
  arrow: css({
    flexShrink: 0,
    color: { base: theme.mutedForeground, ":is(a:hover *)": accent.base },
  }),
}

export type Choice = {
  title: string
  how: string
  href: string
  logo?: Logo
  /** The fallback glyph when there is no logo. */
  icon?: IconProps["icon"]
  /** A full-width card, with a row of logos on its right. */
  wide?: readonly SvglIcon[]
}

export function ChoiceGrid({
  choices,
  columns = 3,
  slot,
  tiles = false,
}: {
  choices: readonly Choice[]
  columns?: 2 | 3 | 4
  /** `data-slot`, for conformance and tests. */
  slot: string
  /** The guide grid's larger tiles, whose line wraps. */
  tiles?: boolean
}) {
  return (
    <div
      sx={[styles.grid, tiles ? styles.tiles : null]}
      data-slot={slot}
      style={{ "--columns": columns } as React.CSSProperties}
    >
      {choices.map((choice) => (
        <DocsLink
          key={choice.title}
          href={choice.href}
          sx={[
            styles.card,
            choice.wide ? styles.wide : null,
            tiles ? styles.tile : null,
          ]}
        >
          <span sx={[styles.logo, tiles ? styles.tileLogo : null]}>
            {choice.logo ? (
              <LogoIcon
                logo={choice.logo}
                size={tiles ? "1.375rem" : "1.25rem"}
              />
            ) : (
              <Icon icon={choice.icon ?? PackageIcon} size="1.125rem" />
            )}
          </span>
          <span sx={[styles.text, tiles ? styles.tileText : null]}>
            <span sx={styles.title}>{choice.title}</span>
            <span sx={[styles.how, tiles ? styles.tileHow : null]}>
              {choice.how}
            </span>
          </span>
          {choice.wide ? (
            <span sx={styles.logos} aria-hidden="true">
              {choice.wide.map((icon) => (
                <BrandIcon key={icon.title} icon={icon} size="1rem" />
              ))}
            </span>
          ) : null}
          {tiles ? null : (
            <Icon icon={ArrowRight01Icon} size="0.875rem" sx={styles.arrow} />
          )}
        </DocsLink>
      ))}
    </div>
  )
}
