/**
 * One docs page: the section it belongs to and the copy-page menu above the
 * article, previous and next pages below it, the table of contents beside it
 * on wide screens.
 */
import { css } from "@kirana-style/core"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { PageMeta } from "@workspace/docs-core/types.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accent } from "./accent.ts"
import { CopyPage } from "./copy-page.tsx"
import { useDocs } from "./provider.tsx"
import { TableOfContents } from "./toc.tsx"

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[10],
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[8], [breakpoint.md]: spacing[10] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.xl]: "minmax(0, 1fr) 15rem",
    },
  }),
  article: css({
    minWidth: 0,
    width: "100%",
    // The layout's width toggle sets `data-wide` on the frame.
    maxWidth: { base: "46rem", ":is([data-wide] *)": "none" },
    marginInline: "auto",
  }),
  top: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBlockEnd: spacing[4],
  }),
  lead: css({ display: "flex", alignItems: "center", gap: spacing[3] }),
  // A framework's page carries its logo beside the section, above the title.
  logo: css({
    display: "grid",
    placeItems: "center",
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    boxShadow: "0 1px 2px rgb(0 0 0 / 0.05)",
  }),
  eyebrow: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: accent.base,
  }),
  railFooter: css({ marginBlockStart: spacing[8] }),
  rail: css({
    display: { base: "none", [breakpoint.xl]: "block" },
    position: "sticky",
    insetBlockStart: spacing[20],
    alignSelf: "start",
    maxHeight: "calc(100dvh - 7rem)",
    overflowY: "auto",
    scrollbarWidth: "thin",
  }),
  pager: css({
    display: "grid",
    gap: spacing[3],
    marginBlockStart: spacing[14],
    gridTemplateColumns: { base: "minmax(0, 1fr)", [breakpoint.sm]: "1fr 1fr" },
  }),
  pagerLink: css({
    display: "grid",
    gap: spacing[1],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, ":hover": accent.base },
    padding: spacing[5],
    textDecorationLine: "none",
    transitionProperty: "border-color",
    transitionDuration: duration[150],
  }),
  pagerNext: css({
    textAlign: "end",
    gridColumn: { base: "auto", [breakpoint.sm]: "2" },
  }),
  pagerLabel: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: "0.625rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  pagerNextLabel: css({ justifyContent: "flex-end" }),
  pagerTitle: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
}

export function DocsPage({
  meta,
  previous,
  next,
  children,
}: {
  meta: PageMeta
  previous?: PageMeta
  next?: PageMeta
  children: React.ReactNode
}) {
  const { Link, nav, pageIcon, railFooter } = useDocs()
  const logo = pageIcon?.(meta.href, "1.375rem")
  const section = nav.find((group) => group.slug === meta.section)?.label

  return (
    <div sx={styles.grid}>
      <article sx={styles.article} data-slot="docs-article">
        <div sx={styles.top}>
          <span sx={styles.lead}>
            {logo ? <span sx={styles.logo}>{logo}</span> : null}
            <span sx={styles.eyebrow}>{section}</span>
          </span>
          <CopyPage href={meta.href} />
        </div>
        {children}
        <nav sx={styles.pager} aria-label="Pagination">
          {previous ? (
            <Link href={previous.href} sx={styles.pagerLink}>
              <span sx={styles.pagerLabel}>
                <Icon icon={ArrowLeft01Icon} size="0.75rem" />
                Previous
              </span>
              <span sx={styles.pagerTitle}>{previous.title}</span>
            </Link>
          ) : null}
          {next ? (
            <Link href={next.href} sx={[styles.pagerLink, styles.pagerNext]}>
              <span sx={[styles.pagerLabel, styles.pagerNextLabel]}>
                Next
                <Icon icon={ArrowRight01Icon} size="0.75rem" />
              </span>
              <span sx={styles.pagerTitle}>{next.title}</span>
            </Link>
          ) : null}
        </nav>
      </article>
      <aside sx={styles.rail}>
        <TableOfContents headings={meta.headings} />
        {railFooter ? <div sx={styles.railFooter}>{railFooter}</div> : null}
      </aside>
    </div>
  )
}
