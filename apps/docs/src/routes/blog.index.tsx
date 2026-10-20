import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
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

import { PostLabel, PostRow, blog, slugOf } from "@/components/blog/post-row"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { Rail } from "@/components/site/patterns"
import { POSTS } from "@/generated/content.gen"

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "Blog · Kirana" },
      {
        name: "description",
        content:
          "Notes from building Kirana: the design, the measurements, and what we got wrong.",
      },
    ],
  }),
})

const TAGS = [...new Set(POSTS.flatMap((post) => post.tags))].sort()

const styles = {
  // The filter bar: a ruled strip under the hero, topics on the left as quiet
  // tabs, search on the right.
  bar: css({
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  barInner: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: spacing[3],
  }),
  tags: css({
    display: "flex",
    gap: spacing[1],
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  tag: css({
    flexShrink: 0,
    borderRadius: radius.full,
    paddingInline: spacing["3.5"],
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textTransform: "capitalize",
    cursor: "pointer",
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      "[aria-pressed=true]": theme.foreground,
    },
    backgroundColor: {
      base: "transparent",
      "[aria-pressed=true]": theme.muted,
    },
    fontWeight: {
      base: fontWeight.normal,
      "[aria-pressed=true]": fontWeight.medium,
    },
    transitionProperty: "background-color, color",
    transitionDuration: duration[150],
  }),
  search: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    width: { base: "100%", [breakpoint.sm]: "16rem" },
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, ":focus-within": accent.base },
    boxShadow: { base: "none", ":focus-within": `0 0 0 3px ${tint(25)}` },
    backgroundColor: theme.background,
    paddingInline: spacing[4],
    color: theme.mutedForeground,
  }),
  input: css({
    flex: 1,
    minWidth: 0,
    paddingBlock: spacing[2],
    backgroundColor: "transparent",
    fontSize: fontSize.sm,
    color: theme.foreground,
    outlineStyle: "none",
  }),
  // The latest post, large: its cover across the rail, then its title beside its summary.
  featured: css({
    display: "grid",
    gap: { base: spacing[6], [breakpoint.md]: spacing[8] },
    paddingBlockEnd: { base: spacing[8], [breakpoint.md]: spacing[12] },
    textDecorationLine: "none",
    color: theme.foreground,
  }),
  featuredCover: css({
    display: "block",
    width: "100%",
    aspectRatio: { base: "4 / 3", [breakpoint.md]: "21 / 9" },
    objectFit: "cover",
    borderRadius: radius.xl,
    backgroundColor: theme.muted,
  }),
  featuredBody: css({
    display: "grid",
    gap: { base: spacing[4], [breakpoint.lg]: spacing[16] },
    alignItems: "start",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1.2fr) minmax(0, 1fr)",
    },
  }),
  featuredHead: css({ display: "grid", gap: spacing[4] }),
  featuredTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.title,
    lineHeight: textLeading.title,
    letterSpacing: textTracking.title,
    fontWeight: fontWeight.normal,
    textWrap: "balance",
    textDecorationLine: { base: "none", ":is(a:hover *)": "underline" },
    textDecorationThickness: "1px",
    textUnderlineOffset: "0.15em",
  }),
  featuredSummary: css({
    fontSize: textSize.lede,
    lineHeight: textLeading.lede,
    color: theme.mutedForeground,
    textWrap: "pretty",
    paddingBlockStart: { [breakpoint.lg]: spacing[2] },
  }),
  empty: css({ color: theme.mutedForeground }),
}

function BlogIndex() {
  const [tag, setTag] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const posts = POSTS.filter(
    (post) =>
      (!tag || post.tags.includes(tag)) &&
      (!needle ||
        `${post.title} ${post.summary}`.toLowerCase().includes(needle))
  )
  const [first, ...rest] = posts
  const filtered = tag !== null || needle !== ""

  return (
    <Page scene="lighthouse-coast">
      <PageHero
        label="Blog"
        title="Notes from building Kirana"
        lede="The design, the measurements with their method, and what we got wrong on the way."
      />
      <div sx={styles.bar}>
        <Rail sx={styles.barInner}>
          <div sx={styles.tags} role="group" aria-label="Filter by topic">
            <button
              type="button"
              aria-pressed={tag === null}
              sx={styles.tag}
              onClick={() => setTag(null)}
            >
              All
            </button>
            {TAGS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={tag === name}
                sx={styles.tag}
                onClick={() => setTag(tag === name ? null : name)}
              >
                {name}
              </button>
            ))}
          </div>
          <label sx={styles.search}>
            <Icon icon={Search01Icon} size="0.875rem" />
            <input
              type="search"
              placeholder="Search posts"
              aria-label="Search posts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={styles.input}
            />
          </label>
        </Rail>
      </div>
      <PageSection>
        {first && !filtered ? (
          <Link
            to="/blog/$slug"
            params={{ slug: slugOf(first) }}
            {...styleProps(styles.featured)}
          >
            {first.cover ? (
              <img
                src={first.cover}
                alt={first.coverAlt ?? ""}
                sx={styles.featuredCover}
              />
            ) : null}
            <span sx={styles.featuredBody}>
              <span sx={styles.featuredHead}>
                <PostLabel post={first} />
                <span sx={styles.featuredTitle}>{first.title}</span>
              </span>
              <span sx={styles.featuredSummary}>{first.summary}</span>
            </span>
          </Link>
        ) : null}

        {posts.length === 0 ? (
          <p sx={styles.empty}>No post matches.</p>
        ) : (
          <div sx={blog.list}>
            {(filtered ? posts : rest).map((post) => (
              <PostRow key={post.href} post={post} />
            ))}
          </div>
        )}
      </PageSection>
    </Page>
  )
}
