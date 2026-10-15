/**
 * `<!-- ::frameworks -->`: every guide, grouped, as the installation page lists
 * them; `<!-- ::guides group="bundlers" -->`: one group, as tiles with a logo,
 * the name and a line about it (the "Choose a framework" page's tabs). The markdown
 * twins get the same lists as plain links (`frameworksMarkdown`,
 * `guidesMarkdown`, wired in `scripts/generate-content.ts`).
 */
import { css } from "@kirana-style/core"

import { spacing } from "@workspace/ui/tokens/spacing"
import { theme } from "@workspace/ui/theme/semantic"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
} from "@workspace/ui/tokens/typography"

import { PAGE_LOGOS } from "@/components/site/brands"
import { FRAMEWORK_GUIDES, GUIDE_GROUPS } from "@/data/frameworks"
import type { GuideGroup } from "@/data/frameworks"

import { ChoiceGrid } from "./choice-grid"

const styles = {
  eyebrow: css({
    marginBlockEnd: spacing[3],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
}

function guidesOf(group: GuideGroup) {
  return FRAMEWORK_GUIDES.filter((guide) => guide.group === group).map(
    (guide) => ({
      title: guide.title,
      how: guide.description,
      href: guide.href,
      logo: PAGE_LOGOS[guide.href],
    })
  )
}

/** One group's guides as tiles, under the group's name when `title` is given. */
export function GuideGrid({
  group = "frameworks",
  title,
}: {
  group?: string
  title?: string
}) {
  return (
    <section data-slot="guide-grid">
      {title ? <p sx={styles.eyebrow}>{title}</p> : null}
      <ChoiceGrid
        slot="guide-grid-tiles"
        choices={guidesOf(group as GuideGroup)}
        tiles
      />
    </section>
  )
}

/** Every guide, group by group, with each group's name above it. */
export function FrameworkGrid() {
  return (
    <>
      {(Object.keys(GUIDE_GROUPS) as GuideGroup[]).map((group) => (
        <section key={group} data-slot="framework-grid">
          <p sx={styles.eyebrow}>{GUIDE_GROUPS[group]}</p>
          <ChoiceGrid slot="framework-grid-group" choices={guidesOf(group)} />
        </section>
      ))}
    </>
  )
}
