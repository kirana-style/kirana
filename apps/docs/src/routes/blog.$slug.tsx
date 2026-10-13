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

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { TableOfContents } from "@workspace/docs-ui/toc.tsx"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
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
import { markdownComponents } from "@/components/markdown"
import { SiteFooter, SiteHeader } from "@/components/site-chrome"
import { Rail } from "@/components/site/patterns"
import { LIFT, REST } from "@/components/site/lift"
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

const styles = {
  header: css({
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  headerInner: css({
    display: "grid",
    gap: spacing[5],
    justifyItems: "start",
    maxWidth: "52rem",
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlockStart: { base: spacing[10], [breakpoint.md]: spacing[16] },
    paddingBlockEnd: spacing[10],
  }),
  back: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.sm,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
  }),
  tags: css({ display: "flex", flexWrap: "wrap", gap: spacing[2] }),
  tag: css({
    borderRadius: radius.full,
    backgroundColor: tint(12),
    color: accent.base,
    paddingInline: spacing[2],
    fontSize: "0.6875rem",
    lineHeight: "1.25rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["3xl"], [breakpoint.md]: fontSize["5xl"] },
    lineHeight: { base: lineHeight["3xl"], [breakpoint.md]: lineHeight["5xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tighter,
    textWrap: "balance",
  }),
  meta: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  layout: css({
    display: "grid",
    gap: spacing[10],
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: spacing[10],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) 16rem",
      [breakpoint.xl]: "13rem minmax(0, 1fr) 16rem",
    },
  }),
  toc: css({
    display: { base: "none", [breakpoint.xl]: "block" },
    position: "sticky",
    insetBlockStart: spacing[20],
    alignSelf: "start",
  }),
  article: css({ minWidth: 0, maxWidth: "44rem" }),
  cover: css({
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
    borderRadius: radius.xl,
    marginBlockEnd: spacing[8],
    backgroundColor: theme.muted,
  }),
  summary: css({
    display: "grid",
    gap: spacing[2],
    marginBlockEnd: spacing[8],
    borderRadius: radius.xl,
    borderInlineStartWidth: "3px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: accent.base,
    backgroundColor: tint(7),
    paddingInline: spacing[5],
    paddingBlock: spacing[4],
    fontSize: fontSize.base,
    lineHeight: "1.65",
  }),
  summaryLabel: css({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: accent.base,
  }),
  aside: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[4],
    position: { base: "static", [breakpoint.lg]: "sticky" },
    insetBlockStart: spacing[20],
    alignSelf: "start",
  }),
  box: css({
    display: "grid",
    gap: spacing[3],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: spacing[5],
  }),
  boxLabel: css({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  author: css({ display: "flex", alignItems: "center", gap: spacing[3] }),
  avatar: css({
    display: "grid",
    placeItems: "center",
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.full,
    backgroundColor: tint(18),
    color: accent.base,
    fontWeight: fontWeight.semibold,
  }),
  authorName: css({ fontWeight: fontWeight.semibold, fontSize: fontSize.sm }),
  share: css({ display: "flex", gap: spacing[2] }),
  shareButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    borderRadius: radius.md,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    paddingInline: spacing["2.5"],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.xs,
    color: theme.foreground,
    textDecorationLine: "none",
    cursor: "pointer",
    transitionProperty: "box-shadow",
    transitionDuration: duration[150],
  }),
  product: css({ backgroundColor: tint(8), borderColor: tint(30) }),
  productTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.bold,
  }),
  productText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  more: css({
    display: "grid",
    gap: spacing[2],
  }),
  moreLink: css({
    fontSize: fontSize.sm,
    lineHeight: "1.5",
    color: { base: theme.foreground, ":hover": accent.base },
    textDecorationLine: "none",
  }),
}

function format(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      sx={styles.shareButton}
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      <Icon icon={copied ? Tick02Icon : Copy01Icon} size="0.8125rem" />
      {copied ? "Copied" : "Copy link"}
    </button>
  )
}

function Post() {
  const { meta, document } = Route.useLoaderData()
  const url = `${SITE}${meta.href}`
  const others = POSTS.filter((post) => post.href !== meta.href).slice(0, 3)
  const initials = meta.author
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")

  return (
    <>
      <SiteHeader />
      <main sx={accents.amber}>
        <header sx={styles.header}>
          <Rail>
            <div sx={styles.headerInner}>
              <Link to="/blog" {...styleProps(styles.back)}>
                <Icon icon={ArrowLeft01Icon} size="0.875rem" />
                All posts
              </Link>
              <div sx={styles.tags}>
                {meta.tags.map((tag) => (
                  <span key={tag} sx={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <h1 sx={styles.title}>{meta.title}</h1>
              <p sx={styles.meta}>
                <time dateTime={meta.date}>{format(meta.date)}</time>
                <span>·</span>
                <span>{meta.readingMinutes} min read</span>
              </p>
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
            <div sx={styles.summary}>
              <span sx={styles.summaryLabel}>In short</span>
              {meta.summary}
            </div>
            <Markdown components={markdownComponents}>{document}</Markdown>
          </article>
          <aside sx={styles.aside}>
            <div sx={styles.box}>
              <span sx={styles.boxLabel}>Written by</span>
              <div sx={styles.author}>
                <span sx={styles.avatar} aria-hidden="true">
                  {initials}
                </span>
                <span sx={styles.authorName}>{meta.author}</span>
              </div>
            </div>
            <div sx={styles.box}>
              <span sx={styles.boxLabel}>Share</span>
              <div sx={styles.share}>
                <CopyLink url={url} />
                <a
                  href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(meta.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  sx={styles.shareButton}
                >
                  <BrandIcon icon={SVGL.x} size="0.75rem" />
                  Post
                </a>
              </div>
            </div>
            <div sx={[styles.box, styles.product]}>
              <span sx={styles.productTitle}>Try Kirana</span>
              <span sx={styles.productText}>
                Install, configure and style a first component in a few minutes.
              </span>
              <Button
                nativeButton={false}
                render={
                  <DocsLink href="/docs/start/quick-start">
                    Quick start
                  </DocsLink>
                }
              />
            </div>
            {others.length > 0 ? (
              <div sx={styles.box}>
                <span sx={styles.boxLabel}>More posts</span>
                <div sx={styles.more}>
                  {others.map((post) => (
                    <Link
                      key={post.href}
                      to="/blog/$slug"
                      params={{ slug: post.href.replace("/blog/", "") }}
                      {...styleProps(styles.moreLink)}
                    >
                      {post.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </Rail>
      </main>
      <SiteFooter />
    </>
  )
}
