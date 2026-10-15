import { useState } from "react"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"
import { Markdown } from "@tanstack/markdown/react"
import type { MarkdownDocument } from "@tanstack/markdown"
import {
  ArrowLeft01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { SVGL } from "@/generated/svgl-icons.gen"

import { accents } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { TableOfContents } from "@workspace/docs-ui/toc.tsx"
import { Icon } from "@workspace/ui/primitives/icon"
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

import { PostLabel, PostRow, blog } from "@/components/blog/post-row"
import { markdownComponents } from "@/components/markdown"
import { SiteFooter, SiteHeader } from "@/components/site-chrome"
import { ChapterLabel, chapter } from "@/components/site/chapter"
import { Rail } from "@/components/site/patterns"
import { POSTS } from "@/generated/content.gen"

const documents = import.meta.glob<{ default: MarkdownDocument }>(
  "../generated/pages/blog/*.json"
)

const SITE = "https://kirana.style"

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const meta = POSTS.find((post) => post.href === `/blog/${params.slug}`)
    const load = documents[`../generated/pages/blog/${params.slug}.json`]
    if (!meta || !load) throw notFound()
    return { meta, document: (await load()).default }
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.meta.title} · Kirana` },
            { name: "description", content: loaderData.meta.summary },
            ...(loaderData.meta.cover
              ? [{ property: "og:image", content: loaderData.meta.cover }]
              : []),
          ],
        }
      : {},
  component: Post,
})

/**
 * One grid for the header and the body, so the title, the cover and the text share a left edge:
 * the contents on the left from `xl` up, the reading column, and the rest of the rail.
 */
const COLUMNS = {
  base: "minmax(0, 1fr)",
  [breakpoint.xl]: "13rem minmax(0, 44rem) minmax(0, 1fr)",
}

const styles = {
  header: css({
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  headerGrid: css({
    display: "grid",
    columnGap: spacing[12],
    gridTemplateColumns: COLUMNS,
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlockStart: { base: spacing[10], [breakpoint.md]: spacing[16] },
    paddingBlockEnd: { base: spacing[10], [breakpoint.md]: spacing[14] },
  }),
  headerInner: css({
    gridColumn: { base: "1", [breakpoint.xl]: "2 / 4" },
    display: "grid",
    gap: spacing[5],
    justifyItems: "start",
    maxWidth: "50rem",
  }),
  back: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    marginBlockEnd: spacing[3],
    fontSize: fontSize.sm,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
  }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.display2,
    lineHeight: textLeading.display2,
    letterSpacing: textTracking.display2,
    fontWeight: fontWeight.normal,
    textWrap: "balance",
  }),
  lede: css({
    maxWidth: "42rem",
    fontSize: textSize.lede,
    lineHeight: textLeading.lede,
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  layout: css({
    display: "grid",
    columnGap: spacing[12],
    gridTemplateColumns: COLUMNS,
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[10], [breakpoint.md]: spacing[14] },
  }),
  toc: css({
    display: { base: "none", [breakpoint.xl]: "block" },
    position: "sticky",
    insetBlockStart: spacing[24],
    alignSelf: "start",
  }),
  article: css({ minWidth: 0 }),
  cover: css({
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
    borderRadius: radius.xl,
    marginBlockEnd: spacing[10],
    backgroundColor: theme.muted,
  }),
  // The end of the post: who wrote it and how to pass it on, on one ruled line.
  colophon: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
    marginBlockStart: spacing[14],
    paddingBlock: spacing[5],
    borderBlockWidth: "1px",
    borderBlockStyle: "solid",
    borderBlockColor: theme.border,
  }),
  byline: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  bylineName: css({ color: theme.foreground, fontWeight: fontWeight.medium }),
  share: css({ display: "flex", gap: spacing[5] }),
  shareLink: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
    cursor: "pointer",
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  next: css({
    display: "grid",
    gap: spacing[2],
    marginBlockStart: spacing[16],
  }),
  // The label row's hairline already sits above the first post.
  nextList: css({ borderBlockStartWidth: 0 }),
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      sx={styles.shareLink}
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      <Icon icon={copied ? Tick02Icon : Copy01Icon} size="0.875rem" />
      {copied ? "Copied" : "Copy link"}
    </button>
  )
}

function Post() {
  const { meta, document } = Route.useLoaderData()
  const url = `${SITE}${meta.href}`
  const others = POSTS.filter((post) => post.href !== meta.href).slice(0, 3)

  return (
    <>
      <SiteHeader />
      <main sx={accents.dusk}>
        <header sx={styles.header}>
          <Rail sx={styles.headerGrid}>
            <div sx={styles.headerInner}>
              <Link to="/blog" {...styleProps(styles.back)}>
                <Icon icon={ArrowLeft01Icon} size="0.875rem" />
                All posts
              </Link>
              <PostLabel post={meta} />
              <h1 sx={styles.title}>{meta.title}</h1>
              <p sx={styles.lede}>{meta.summary}</p>
            </div>
          </Rail>
        </header>
        <Rail sx={styles.layout}>
          <aside sx={styles.toc}>
            <TableOfContents headings={meta.headings} />
          </aside>
          <article sx={styles.article} data-slot="docs-article">
            {meta.cover ? (
              <img
                src={meta.cover}
                alt={meta.coverAlt ?? ""}
                sx={styles.cover}
              />
            ) : null}
            <Markdown components={markdownComponents}>{document}</Markdown>
            <div sx={styles.colophon}>
              <span sx={styles.byline}>
                Written by <span sx={styles.bylineName}>{meta.author}</span>
              </span>
              <span sx={styles.share}>
                <CopyLink url={url} />
                <a
                  href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(meta.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  sx={styles.shareLink}
                >
                  <BrandIcon icon={SVGL.x} size="0.8125rem" />
                  Share on X
                </a>
              </span>
            </div>
            {others.length > 0 ? (
              <div sx={styles.next}>
                <ChapterLabel
                  aside={
                    <Link to="/blog" {...styleProps(chapter.aside)}>
                      All posts
                    </Link>
                  }
                >
                  More from the blog
                </ChapterLabel>
                <div sx={[blog.list, styles.nextList]}>
                  {others.map((post) => (
                    <PostRow key={post.href} post={post} />
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </Rail>
      </main>
      <SiteFooter scene="city-dusk" />
    </>
  )
}
