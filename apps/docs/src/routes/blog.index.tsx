import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"
import { Search01Icon } from "@hugeicons/core-free-icons"

import type { BlogMeta } from "@workspace/docs-core/types.ts"
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
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { Page, PageHero, PageSection } from "@/components/site/page"
import { Rail, patterns } from "@/components/site/patterns"
import { LIFT, REST } from "@workspace/ui/recipes/lift"
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
  featured: css({
    display: "grid",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1.15fr) minmax(0, 1fr)",
    },
  }),
  featuredBody: css({
    display: "grid",
    alignContent: "center",
    gap: spacing[4],
    padding: { base: spacing[6], [breakpoint.md]: spacing[10] },
  }),
  featuredTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["2xl"], [breakpoint.md]: fontSize["4xl"] },
    lineHeight: { base: lineHeight["2xl"], [breakpoint.md]: lineHeight["4xl"] },
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
  }),
  grid: css({
    display: "grid",
    gap: spacing[5],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  cover: css({
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: "14rem",
    aspectRatio: "16 / 10",
    objectFit: "cover",
    backgroundColor: theme.muted,
  }),
  noCover: css({ minHeight: "14rem", aspectRatio: "16 / 10" }),
  body: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[3],
    padding: spacing[6],
  }),
  title: css({
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.semibold,
    textWrap: "balance",
  }),
  summary: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  meta: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  kicker: css({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: accent.base,
  }),
  empty: css({ color: theme.mutedForeground }),
}

function format(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function Meta({ post }: { post: BlogMeta }) {
  return (
    <span sx={styles.meta}>
      <time dateTime={post.date}>{format(post.date)}</time>
      <span>·</span>
      <span>{post.author}</span>
      <span>·</span>
      <span>{post.readingMinutes} min read</span>
    </span>
  )
}

function Cover({ post }: { post: BlogMeta }) {
  return post.cover ? (
    <img
      src={post.cover}
      alt={post.coverAlt ?? ""}
      loading="lazy"
      sx={styles.cover}
    />
  ) : (
    <span sx={[patterns.hatch, styles.noCover]} aria-hidden="true" />
  )
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
    <Page scene="city-dusk">
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
            params={{ slug: first.href.replace("/blog/", "") }}
            {...styleProps(styles.featured)}
          >
            <Cover post={first} />
            <div sx={styles.featuredBody}>
              <span sx={styles.kicker}>Latest</span>
              <span sx={styles.featuredTitle}>{first.title}</span>
              <span sx={styles.summary}>{first.summary}</span>
              <Meta post={first} />
            </div>
          </Link>
        ) : null}

        {posts.length === 0 ? (
          <p sx={styles.empty}>No post matches.</p>
        ) : (
          <div sx={styles.grid}>
            {(filtered ? posts : rest).map((post) => (
              <Link
                key={post.href}
                to="/blog/$slug"
                params={{ slug: post.href.replace("/blog/", "") }}
                {...styleProps(styles.card)}
              >
                <Cover post={post} />
                <div sx={styles.body}>
                  <span sx={styles.kicker}>{post.tags[0]}</span>
                  <span sx={styles.title}>{post.title}</span>
                  <span sx={styles.summary}>{post.summary}</span>
                  <Meta post={post} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageSection>
    </Page>
  )
}
