/**
 * A chapter's heading: how every section of a page opens.
 *
 * A label row (the chapter's number in the page's hue, its name in small mono capitals, a hairline
 * to the edge, and an optional link at the end), the title in the serif, and a lede. The numbers
 * let a reader keep their place down a long page; the label says what the chapter is about in two
 * or three words, so the title is free to say something.
 *
 * The serif is set at its regular weight. One word of a page's headline may be italic in the
 * page's hue (`Accent`, in page.tsx); in a chapter title an `<em>` is italic in ink.
 */
import { css, props as styleProps } from "@kirana-style/core"

import { accent } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

export const chapter = {
  head: css({ display: "grid", gap: spacing[4] }),
  labelRow: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    minWidth: 0,
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
  }),
  number: css({ color: accent.base, fontWeight: fontWeight.medium }),
  name: css({ color: theme.foreground, whiteSpace: "nowrap" }),
  rule: css({
    flex: "1 1 auto",
    minWidth: spacing[6],
    height: "1px",
    backgroundColor: theme.border,
  }),
  aside: css({
    flexShrink: 0,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
    whiteSpace: "nowrap",
  }),
  title: css({
    maxWidth: "48rem",
    fontFamily: fontFamily.heading,
    fontSize: textSize.title,
    lineHeight: textLeading.title,
    letterSpacing: textTracking.title,
    fontWeight: fontWeight.normal,
    color: theme.foreground,
    textWrap: "balance",
  }),
  lede: css({
    maxWidth: "42rem",
    fontSize: textSize.lede,
    lineHeight: textLeading.lede,
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
}

/** The label row alone: a number, a name, the hairline, and an optional link at the end. */
export function ChapterLabel({
  number,
  children,
  aside,
  sx,
}: {
  number?: string
  children: React.ReactNode
  aside?: React.ReactNode
  sx?: Sx
}) {
  return (
    <p sx={[chapter.labelRow, sx]}>
      {number ? <span sx={chapter.number}>{number}</span> : null}
      <span sx={chapter.name}>{children}</span>
      <span sx={chapter.rule} aria-hidden="true" />
      {aside}
    </p>
  )
}

/** A chapter's whole heading: the label row, the title and the lede. */
export function Chapter({
  number,
  label,
  title,
  lede,
  aside,
  as: Heading = "h2",
  sx,
}: {
  number?: string
  label: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  aside?: React.ReactNode
  as?: "h2" | "h3"
  sx?: Sx
}) {
  return (
    <div sx={[chapter.head, sx]}>
      <ChapterLabel number={number} aside={aside}>
        {label}
      </ChapterLabel>
      {/* A dynamic tag is not a host element the compiler can see: spread the styles. */}
      <Heading {...styleProps(chapter.title)}>{title}</Heading>
      {lede ? <p sx={chapter.lede}>{lede}</p> : null}
    </div>
  )
}
