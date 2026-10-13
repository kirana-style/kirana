import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { Clock01Icon } from "@hugeicons/core-free-icons"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { CHANGELOG, TAG_ACCENTS } from "@/data/changelog"
import type { Tag } from "@/data/changelog"

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Changelog · Kirana" },
      {
        name: "description",
        content:
          "What changed in Kirana, milestone by milestone, until the first release.",
      },
    ],
  }),
})

const TAGS = Object.keys(TAG_ACCENTS) as Tag[]

const styles = {
  filters: css({ display: "flex", flexWrap: "wrap", gap: spacing[2] }),
  filter: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, "[aria-pressed=true]": tint(45) },
    backgroundColor: { base: "transparent", "[aria-pressed=true]": tint(10) },
    paddingInline: spacing[3],
    paddingBlock: spacing[1],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textTransform: "capitalize",
    cursor: "pointer",
    transitionProperty: "background-color, border-color",
    transitionDuration: duration[150],
  }),
  dot: css({
    width: spacing[2],
    height: spacing[2],
    borderRadius: radius.full,
    backgroundColor: accent.base,
  }),
  list: css({ display: "grid" }),
  entry: css({
    position: "relative",
    display: "grid",
    gap: { base: spacing[3], [breakpoint.md]: spacing[10] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "10rem minmax(0, 1fr)",
    },
    paddingBlock: spacing[8],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "dashed",
    borderBlockStartColor: theme.border,
  }),
  date: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
    paddingBlockStart: spacing[1],
  }),
  body: css({ display: "grid", gap: spacing[3], justifyItems: "start" }),
  tags: css({ display: "flex", flexWrap: "wrap", gap: spacing[2] }),
  tag: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    borderRadius: radius.full,
    backgroundColor: tint(12),
    color: accent.base,
    paddingInline: spacing[2],
    paddingBlock: "1px",
    fontSize: "0.6875rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    fontWeight: fontWeight.bold,
  }),
  summary: css({
    fontSize: fontSize.base,
    lineHeight: "1.7",
    color: theme.mutedForeground,
  }),
  items: css({
    display: "grid",
    gap: spacing["1.5"],
    paddingInlineStart: spacing[5],
    listStyleType: "disc",
    fontSize: fontSize.sm,
    lineHeight: "1.65",
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

function ChangelogPage() {
  const [tag, setTag] = useState<Tag | null>(null)
  const entries = tag
    ? CHANGELOG.filter((entry) => entry.tags.includes(tag))
    : CHANGELOG

  return (
    <Page accent="violet">
      <PageHero
        icon={Clock01Icon}
        pattern="scan"
        eyebrow="Changelog"
        title="What changed, and when"
        lede="Nothing is published yet, so there are no versions to list. Until there are, this is the record: each milestone and sprint from the implementation tracker, dated by the commit that landed it."
      />
      <PageSection>
        <div sx={styles.filters} role="group" aria-label="Filter by topic">
          {TAGS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tag === name}
              sx={[accents[TAG_ACCENTS[name]], styles.filter]}
              onClick={() => setTag(tag === name ? null : name)}
            >
              <span sx={styles.dot} />
              {name}
            </button>
          ))}
        </div>
        <ol sx={styles.list}>
          {entries.map((entry) => (
            <li key={entry.date + entry.title} sx={styles.entry}>
              <time dateTime={entry.date} sx={styles.date}>
                {format(entry.date)}
              </time>
              <div sx={styles.body}>
                <div sx={styles.tags}>
                  {entry.tags.map((name) => (
                    <span
                      key={name}
                      sx={[accents[TAG_ACCENTS[name]], styles.tag]}
                    >
                      <span sx={styles.dot} />
                      {name}
                    </span>
                  ))}
                </div>
                <h2 sx={styles.title}>{entry.title}</h2>
                <p sx={styles.summary}>{entry.summary}</p>
                {entry.items.length > 0 ? (
                  <ul sx={styles.items}>
                    {entry.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {entry.href ? (
                  <DocsLink href={entry.href}>
                    <More>Read more</More>
                  </DocsLink>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <DocsLink href="/docs/project/releases">
          <More>How versions will work</More>
        </DocsLink>
      </PageSection>
    </Page>
  )
}
