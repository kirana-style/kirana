/**
 * /changelog: every published version, read from `CHANGELOG.md` (`data/releases.ts`), then the
 * record from before the first release (`data/changelog.ts`). A release is a chapter: its version
 * and date on the left, kept in view while its changes scroll; on the right its changes, grouped
 * as the changelog groups them, one ruled row each with its scope and the pull request it came in.
 */
import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { LinkSquare02Icon } from "@hugeicons/core-free-icons"

import type { Release } from "@workspace/docs-core/changelog.ts"
import { accent } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
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

import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { CHANGELOG } from "@/data/changelog"
import { RELEASES } from "@/data/releases"

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Changelog · Kirana" },
      {
        name: "description",
        content:
          "Every published version of Kirana and what changed in it, read from the repository's changelog.",
      },
    ],
  }),
})

const label = {
  fontFamily: fontFamily.mono,
  fontSize: textSize.label,
  lineHeight: textLeading.label,
  letterSpacing: textTracking.label,
  textTransform: "uppercase",
} as const

const styles = {
  release: css({
    display: "grid",
    gap: { base: spacing[6], [breakpoint.md]: spacing[12] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "12rem minmax(0, 1fr)",
    },
  }),
  // The version, kept in view while its changes scroll past.
  side: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    justifyItems: "start",
    position: { base: "static", [breakpoint.md]: "sticky" },
    insetBlockStart: "6rem",
    alignSelf: "start",
  }),
  version: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.title,
    lineHeight: textLeading.title,
    letterSpacing: textTracking.title,
    fontWeight: fontWeight.normal,
    color: theme.foreground,
  }),
  date: css({ ...label, color: theme.mutedForeground }),
  latest: css({ ...label, color: accent.base }),
  compare: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
  }),
  sections: css({ display: "grid", gap: spacing[10] }),
  section: css({ display: "grid", gap: spacing[3] }),
  sectionTitle: css({ ...label, color: theme.foreground }),
  changes: css({
    display: "grid",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  change: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "baseline",
    gap: spacing[4],
    paddingBlock: spacing[3],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    fontSize: fontSize.base,
    lineHeight: "1.6",
    color: theme.foreground,
  }),
  scope: css({
    marginInlineEnd: spacing[2],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: theme.mutedForeground,
  }),
  link: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
  }),

  // Before the first release.
  history: css({
    display: "grid",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  entry: css({
    display: "grid",
    gap: { base: spacing[2], [breakpoint.md]: spacing[12] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "12rem minmax(0, 1fr)",
    },
    paddingBlock: spacing[6],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  entryBody: css({ display: "grid", gap: spacing[2], justifyItems: "start" }),
  entryTitle: css({
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  entryText: css({
    maxWidth: "46rem",
    fontSize: fontSize.base,
    lineHeight: "1.65",
    color: theme.mutedForeground,
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

/** Commit subjects are lower case; a row reads as a sentence. */
function sentence(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Release-please writes "BREAKING CHANGES" in capitals; the label row sets every title in them. */
function sectionTitle(title: string) {
  return title.toLowerCase() === "breaking changes" ? "Breaking changes" : title
}

function ReleaseRow({
  release,
  latest,
}: {
  release: Release
  latest: boolean
}) {
  return (
    <div sx={styles.release}>
      <div sx={styles.side}>
        {latest ? <span sx={styles.latest}>Latest</span> : null}
        <h2 sx={styles.version} id={`v${release.version}`}>
          {release.version}
        </h2>
        <time dateTime={release.date} sx={styles.date}>
          {format(release.date)}
        </time>
        {release.compare ? (
          <a
            href={release.compare}
            target="_blank"
            rel="noreferrer"
            sx={styles.compare}
          >
            Diff on GitHub
            <Icon icon={LinkSquare02Icon} size="0.75rem" />
          </a>
        ) : null}
      </div>
      <div sx={styles.sections}>
        {release.sections.map((section) => (
          <section key={section.title} sx={styles.section}>
            <h3 sx={styles.sectionTitle}>{sectionTitle(section.title)}</h3>
            <ul sx={styles.changes}>
              {section.changes.map((change) => (
                <li key={change.text} sx={styles.change}>
                  <span>
                    {change.scope ? (
                      <span sx={styles.scope}>{change.scope}</span>
                    ) : null}
                    {sentence(change.text)}
                  </span>
                  {change.pr ? (
                    <a
                      href={change.pr.href}
                      target="_blank"
                      rel="noreferrer"
                      sx={styles.link}
                      aria-label={`Pull request ${change.pr.number}`}
                    >
                      #{change.pr.number}
                    </a>
                  ) : change.commit ? (
                    <a
                      href={change.commit.href}
                      target="_blank"
                      rel="noreferrer"
                      sx={styles.link}
                      aria-label={`Commit ${change.commit.sha}`}
                    >
                      {change.commit.sha}
                    </a>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function ChangelogPage() {
  return (
    <Page scene="forest-falls">
      <PageHero
        label="Changelog"
        title={
          <>
            What changed, <Accent>release by release.</Accent>
          </>
        }
        lede="Every version on npm and what came with it, read from the repository's changelog. Until 1.0, a minor version may change the API, and its notes say how to move."
        actions={
          <DocsLink href="/docs/project/releases">
            <More>Releases and upgrading</More>
          </DocsLink>
        }
      />
      {RELEASES.map((release, index) => (
        <PageSection key={release.version}>
          <ReleaseRow release={release} latest={index === 0} />
        </PageSection>
      ))}
      <PageSection
        label="Before 0.1.0"
        title="The milestones that came first"
        lede="Built in the open before the first version was published, each dated by the commit that landed it."
      >
        <ol sx={styles.history}>
          {CHANGELOG.map((entry) => (
            <li key={entry.date + entry.title} sx={styles.entry}>
              <time dateTime={entry.date} sx={styles.date}>
                {format(entry.date)}
              </time>
              <div sx={styles.entryBody}>
                <h3 sx={styles.entryTitle}>{entry.title}</h3>
                <p sx={styles.entryText}>{entry.summary}</p>
                {entry.href ? (
                  <DocsLink href={entry.href}>
                    <More>Read more</More>
                  </DocsLink>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </PageSection>
    </Page>
  )
}
