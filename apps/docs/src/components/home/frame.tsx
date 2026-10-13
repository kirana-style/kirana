/**
 * The homepage's section frame: every section sits in the rail, ruled above,
 * with an accent eyebrow, a title and an optional lede, left-aligned.
 */
import { css } from "@kirana-style/core"

import { accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { Eyebrow } from "@/components/site/accents"
import { Rail } from "@/components/site/patterns"

export const frame = {
  ruled: css({
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  inner: css({
    display: "grid",
    // One column that may shrink below its content, so a wide child (a tab
    // list, a code block) scrolls inside itself instead of widening the page.
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: { base: spacing[8], [breakpoint.md]: spacing[10] },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[14], [breakpoint.md]: spacing[20] },
  }),
  head: css({ display: "grid", gap: spacing[4], maxWidth: "44rem" }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["3xl"], [breakpoint.md]: fontSize["4xl"] },
    lineHeight: { base: lineHeight["3xl"], [breakpoint.md]: lineHeight["4xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
  }),
  lede: css({
    fontSize: { base: fontSize.base, [breakpoint.md]: fontSize.lg },
    lineHeight: "1.65",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  cardTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.bold,
  }),
  cardText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
}

export function HomeSection({
  id,
  accent,
  icon,
  eyebrow,
  title,
  lede,
  sx,
  children,
}: {
  id?: string
  accent: AccentName
  icon: IconProps["icon"]
  eyebrow: string
  title: React.ReactNode
  lede?: React.ReactNode
  sx?: Sx
  children?: React.ReactNode
}) {
  return (
    <section id={id} sx={[frame.ruled, accents[accent]]}>
      <Rail sx={[frame.inner, sx]}>
        <div sx={frame.head}>
          <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
          <h2 sx={frame.title}>{title}</h2>
          {lede ? <p sx={frame.lede}>{lede}</p> : null}
        </div>
        {children}
      </Rail>
    </section>
  )
}
