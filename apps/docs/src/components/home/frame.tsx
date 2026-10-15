/**
 * The homepage's section frame: every section sits in the rail, ruled above, and opens with a
 * numbered chapter heading (`site/chapter.tsx`), left-aligned.
 */
import { css } from "@kirana-style/core"

import { accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { Chapter, chapter } from "@/components/site/chapter"
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
    gap: { base: spacing[8], [breakpoint.md]: spacing[12] },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[16], [breakpoint.md]: spacing[24] },
  }),
  head: chapter.head,
  title: chapter.title,
  lede: chapter.lede,
  // A card's title is in the sans: the serif is for headings from 1.5rem up.
  cardTitle: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
  }),
  cardText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
}

/**
 * A homepage chapter: ruled above, its number and name, a title and a lede, then the content.
 * It takes the page's hue unless it is a door to another page, which wears that page's.
 */
export function HomeSection({
  id,
  accent,
  number,
  eyebrow,
  title,
  lede,
  aside,
  sx,
  children,
}: {
  id?: string
  /** Only for a chapter that leads to a page in another scene. */
  accent?: AccentName
  number?: string
  eyebrow: string
  title: React.ReactNode
  lede?: React.ReactNode
  aside?: React.ReactNode
  sx?: Sx
  children?: React.ReactNode
}) {
  return (
    <section id={id} sx={[frame.ruled, accent ? accents[accent] : null]}>
      <Rail sx={[frame.inner, sx]}>
        <Chapter
          number={number}
          label={eyebrow}
          title={title}
          lede={lede}
          aside={aside}
        />
        {children}
      </Rail>
    </section>
  )
}
