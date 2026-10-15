import { css } from "@kirana-style/core"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { Rail } from "@/components/site/patterns"

/** The pieces the older pages (brand) and the cards everywhere share. */
export const sectionStyles = {
  // A band ruled below, its content in the rail like every other page.
  section: css({
    position: "relative",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  tinted: css({ backgroundColor: alpha.muted50 }),
  inner: css({
    display: "grid",
    // One column that may shrink below its content, so a wide child (a tab
    // list, a code block) scrolls inside itself instead of widening the page.
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: spacing[10],
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[14], [breakpoint.md]: spacing[20] },
  }),
  bordered: css({
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  eyebrow: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  sub: css({
    fontSize: fontSize.base,
    lineHeight: "1.7",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
}

const styles = {
  header: css({ display: "grid", gap: spacing[3], maxWidth: "42rem" }),
  heading: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["3xl"], [breakpoint.md]: fontSize["4xl"] },
    lineHeight: { base: lineHeight["3xl"], [breakpoint.md]: lineHeight["4xl"] },
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
  }),
  more: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
  }),
}

/** A full-width band whose content sits in the rail. */
export function Section({
  tinted,
  id,
  backdrop,
  sx,
  children,
}: {
  tinted?: boolean
  id?: string
  /** Decoration behind the whole band. */
  backdrop?: React.ReactNode
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      sx={[sectionStyles.section, tinted && sectionStyles.tinted, sx]}
    >
      {backdrop}
      <Rail sx={sectionStyles.inner}>{children}</Rail>
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <header sx={styles.header}>
      <span sx={sectionStyles.eyebrow}>{eyebrow}</span>
      <h2 sx={styles.heading}>{title}</h2>
      {children ? <p sx={sectionStyles.sub}>{children}</p> : null}
    </header>
  )
}

/** "Read more" with an arrow, for the end of a card or a section. */
export function More({ children }: { children: React.ReactNode }) {
  return (
    <span sx={styles.more}>
      {children}
      <Icon icon={ArrowRight01Icon} size="0.875rem" />
    </span>
  )
}
