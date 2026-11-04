/**
 * Every framework with a guide, by its logo, in the docs sidebar's groups: one grid per group for the
 * homepage, `/compiler` and `/ecosystem`, so the list looks and reads the same wherever it appears.
 */
import { css } from "@kirana-style/core"

import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import type { Sx } from "@workspace/ui/lib/sx"
import { pointer } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { LogoIcon, PAGE_LOGOS } from "@/components/site/brands"
import { FRAMEWORK_GROUPS } from "@/data/claims"

const styles = {
  groups: css({ display: "grid", gap: spacing[6] }),
  // The group's name, in the docs sidebar's label voice.
  label: css({
    marginBlockEnd: spacing[3],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  // Hairlines drawn by each cell (its end and bottom edges), so a last row that is not full
  // ends in the card's colour, not in an empty grey slot.
  grid: css({
    display: "grid",
    overflow: "hidden",
    gridTemplateColumns: "repeat(auto-fill, minmax(10.5rem, 1fr))",
    borderRadius: radius.xl,
    borderBlockStartWidth: "1px",
    borderInlineStartWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
  }),
  framework: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["2.5"],
    minHeight: { base: spacing[12], [pointer.coarse]: "2.75rem" },
    paddingInline: spacing[4],
    borderInlineEndWidth: "1px",
    borderBlockEndWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: { base: theme.card, ":hover": alpha.muted50 },
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
    textDecorationLine: "none",
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
}

export function FrameworkGrid({ sx }: { sx?: Sx }) {
  return (
    <nav sx={[styles.groups, sx]} aria-label="Framework guides">
      {FRAMEWORK_GROUPS.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <p sx={styles.label}>{group.label}</p>
          <div sx={styles.grid}>
            {group.items.map((framework) => (
              <DocsLink
                key={framework.href}
                href={framework.href}
                sx={styles.framework}
              >
                {PAGE_LOGOS[framework.href] ? (
                  <LogoIcon logo={PAGE_LOGOS[framework.href]!} />
                ) : null}
                {framework.title}
              </DocsLink>
            ))}
          </div>
        </section>
      ))}
    </nav>
  )
}
