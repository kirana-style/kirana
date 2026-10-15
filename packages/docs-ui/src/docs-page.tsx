/**
 * One docs page: where it sits (tab › section) and the copy-page menu above the
 * article, previous and next pages below it, the table of contents beside it
 * on wide screens.
 */
import { css } from "@kirana-style/core"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { PageMeta } from "@workspace/docs-core/types.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { LIFT, REST } from "@workspace/ui/recipes/lift"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { accent } from "./accent.ts"
import { CopyPage } from "./copy-page.tsx"
import { WidthToggle } from "./width-toggle.tsx"
import { DOCS_CHROME } from "./chrome.ts"
import { tabFor, useDocs } from "./provider.tsx"
import { PageContext } from "./page-context.ts"
import { TableOfContents } from "./toc.tsx"

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[10],
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    // The first line of each column (the sidebar's first label, the breadcrumb, "On this
    // page") sits the same distance under the chrome.
    paddingBlock: spacing[8],
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
  tools: css({ display: "flex", alignItems: "center", gap: spacing[2] }),
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
  // Tab › section: the tab links to its first page, the section is where you are.
  crumbs: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  crumbLink: css({
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  crumbHere: css({ fontWeight: fontWeight.medium, color: accent.base }),
  railFooter: css({ marginBlockStart: spacing[8] }),
  rail: css({
    display: { base: "none", [breakpoint.xl]: "block" },
    position: "sticky",
    // Under the bar and the tab row, which are both sticky from lg up.
    insetBlockStart: `calc(${DOCS_CHROME} + ${spacing[6]})`,
    alignSelf: "start",
    // Centres "On this page" on the breadcrumb's row, which the copy button makes taller.
    paddingBlockStart: spacing[2],
    maxHeight: `calc(100dvh - ${DOCS_CHROME} - ${spacing[12]})`,
    overflowY: "auto",
    scrollbarWidth: "thin",
  }),
  pager: css({
    display: "grid",
    gap: spacing[3],
    marginBlockStart: spacing[14],
    gridTemplateColumns: { base: "minmax(0, 1fr)", [breakpoint.sm]: "1fr 1fr" },
  }),
  // The site's card hover: the border stays, the card lifts.
  pagerLink: css({
    display: "grid",
    gap: spacing[1],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    boxShadow: { base: REST, ":hover": LIFT },
    padding: spacing[5],
    textDecorationLine: "none",
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  pagerNext: css({
    textAlign: "end",
    gridColumn: { base: "auto", [breakpoint.sm]: "2" },
  }),
  pagerLabel: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[1],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
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
  const { Link, nav, tabs, pageIcon, railFooter } = useDocs()
  const logo = pageIcon?.(meta.href, "1.375rem")
  const section = nav.find((group) => group.slug === meta.section)?.label
  const tab = tabFor(tabs, meta.section)

  return (
    <div sx={styles.grid}>
      <article sx={styles.article} data-slot="docs-article">
        <div sx={styles.top}>
          <span sx={styles.lead}>
            {logo ? <span sx={styles.logo}>{logo}</span> : null}
            <nav sx={styles.crumbs} aria-label="Breadcrumb">
              {/* A section named like its tab (Frameworks, Project) is said once. */}
              {tab && tab.label !== section ? (
                <>
                  <Link href={tab.href} sx={styles.crumbLink}>
                    {tab.label}
                  </Link>
                  <Icon icon={ArrowRight01Icon} size="0.75rem" />
                </>
              ) : null}
              <span sx={styles.crumbHere} aria-current="location">
                {section}
              </span>
            </nav>
          </span>
          <span sx={styles.tools}>
            <WidthToggle />
            <CopyPage href={meta.href} />
          </span>
        </div>
        <PageContext value={meta}>{children}</PageContext>
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
