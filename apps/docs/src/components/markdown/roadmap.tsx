/**
 * `<!-- ::roadmap -->`: the milestones at a glance, from `data/roadmap.ts`. One cell each, split
 * by 1px gutters, in order: the id and its status in the mono label (a filled pixel when done, an
 * outlined one for what is next), the name, and a line. Each cell opens its section of the page.
 */
import { css } from "@kirana-style/core"

import { accent } from "@workspace/docs-ui/accent.ts"
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

import { MILESTONES } from "@/data/roadmap"

const styles = {
  grid: css({
    display: "grid",
    gap: "1px",
    overflow: "hidden",
    marginBlock: spacing[8],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  cell: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: { base: theme.background, ":hover": theme.muted },
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  label: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  id: css({ color: theme.foreground }),
  // One pixel of the page's hue: filled when done, outlined for what comes next.
  pixel: css({
    width: "0.5rem",
    height: "0.5rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: accent.base,
  }),
  done: css({ backgroundColor: accent.base }),
  // An odd count leaves a column empty in the last row: the last milestone fills it.
  last: css({ gridColumn: "span 2" }),
  name: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  line: css({
    fontSize: fontSize.xs,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
}

export function RoadmapOverview() {
  return (
    <nav sx={styles.grid} aria-label="Milestones" data-slot="roadmap">
      {MILESTONES.map((milestone, index) => (
        <a
          key={milestone.id}
          href={`#${milestone.anchor}`}
          sx={[
            styles.cell,
            index === MILESTONES.length - 1 && MILESTONES.length % 2
              ? styles.last
              : null,
          ]}
        >
          <span sx={styles.label}>
            <span
              sx={[
                styles.pixel,
                milestone.status === "Done" ? styles.done : null,
              ]}
              aria-hidden="true"
            />
            <span sx={styles.id}>{milestone.id}</span>
            <span>{milestone.status}</span>
          </span>
          <span sx={styles.name}>{milestone.name}</span>
          <span sx={styles.line}>{milestone.line}</span>
        </a>
      ))}
    </nav>
  )
}
