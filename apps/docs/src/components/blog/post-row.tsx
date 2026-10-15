/**
 * The blog's pieces, shared by the index and the end of every post: a post as a ruled row (the
 * title in the serif, the summary, the mono line of date, reading time and topics, and the cover
 * on the right), and that mono line on its own, as it sits under a post's title.
 */
import { Link } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"

import type { BlogMeta } from "@workspace/docs-core/types.ts"
import { accent } from "@workspace/docs-ui/accent.ts"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

export const blog = {
  label: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing[2],
    rowGap: spacing[1],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  topic: css({ color: accent.base }),
  list: css({
    display: "grid",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  row: css({
    display: "grid",
    gap: { base: spacing[4], [breakpoint.md]: spacing[8] },
    alignItems: "start",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) 14rem",
      [breakpoint.lg]: "minmax(0, 1fr) 18rem",
    },
    paddingBlock: spacing[8],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    textDecorationLine: "none",
    color: theme.foreground,
  }),
  body: css({ display: "grid", gap: spacing[3], alignContent: "start" }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.heading,
    lineHeight: 1.2,
    letterSpacing: textTracking.title,
    fontWeight: fontWeight.normal,
    textWrap: "balance",
    textDecorationLine: { base: "none", ":is(a:hover *)": "underline" },
    textDecorationThickness: "1px",
    textUnderlineOffset: "0.18em",
  }),
  summary: css({
    maxWidth: "40rem",
    fontSize: fontSize.base,
    lineHeight: "1.65",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  thumb: css({
    order: { base: -1, [breakpoint.md]: 0 },
    display: "block",
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: radius.lg,
    backgroundColor: theme.muted,
    opacity: { base: 1, ":is(a:hover *)": 0.92 },
    transitionProperty: "opacity",
    transitionDuration: duration[200],
  }),
}

export function slugOf(post: BlogMeta) {
  return post.href.replace("/blog/", "")
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Date, reading time and topics, in the mono label. */
export function PostLabel({ post }: { post: BlogMeta }) {
  return (
    <span sx={blog.label}>
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      <span aria-hidden="true">·</span>
      <span>{post.readingMinutes} min read</span>
      {post.tags.map((tag) => (
        <span key={tag} sx={blog.topic}>
          <span aria-hidden="true">· </span>
          {tag}
        </span>
      ))}
    </span>
  )
}

export function PostRow({ post }: { post: BlogMeta }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: slugOf(post) }}
      {...styleProps(blog.row)}
    >
      <span sx={blog.body}>
        <span sx={blog.title}>{post.title}</span>
        <span sx={blog.summary}>{post.summary}</span>
        <PostLabel post={post} />
      </span>
      {post.cover ? (
        <img
          src={post.cover}
          alt={post.coverAlt ?? ""}
          loading="lazy"
          sx={blog.thumb}
        />
      ) : (
        <span />
      )}
    </Link>
  )
}
