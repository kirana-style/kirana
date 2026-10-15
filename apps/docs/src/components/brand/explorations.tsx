import { css } from "@kirana-style/core"

import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { PETAL_K, SURFACES } from "@/brand/explorations"
import type { Exploration } from "@/brand/explorations"
import { sectionStyles } from "@/components/page-section"

const styles = {
  mark: css({ display: "block", flexShrink: 0 }),
  layout: css({ display: "grid", gap: spacing[6] }),

  detail: css({
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
  }),
  head: css({
    display: "grid",
    gap: spacing[6],
    padding: { base: spacing[6], [breakpoint.md]: spacing[8] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 1fr)",
    },
    alignItems: "center",
  }),
  hero: css({
    display: "grid",
    placeItems: "center",
    aspectRatio: "4 / 3",
    borderRadius: radius.lg,
  }),
  heroMark: css({ width: "38%", height: "auto" }),
  copy: css({ display: "grid", gap: spacing[4], alignContent: "start" }),
  name: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize["3xl"],
    lineHeight: lineHeight["3xl"],
    fontWeight: fontWeight.normal,
  }),
  idea: css({
    fontSize: fontSize.lg,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  formula: css({
    display: "grid",
    gap: spacing[2],
    paddingInlineStart: spacing[4],
    listStyleType: "disc",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: "1.7",
    color: theme.mutedForeground,
  }),
  sizes: css({
    display: "flex",
    alignItems: "end",
    gap: spacing[6],
    color: theme.foreground,
  }),
  sizeMark: css({ color: theme.foreground }),
  sizeLabel: css({
    display: "grid",
    gap: spacing[2],
    justifyItems: "center",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),

  surfaces: css({
    display: "grid",
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  surface: css({
    position: "relative",
    display: "grid",
    placeItems: "center",
    aspectRatio: "4 / 3",
  }),
  surfaceName: css({
    position: "absolute",
    insetInlineStart: spacing[3],
    insetBlockEnd: spacing[2],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    opacity: 0.7,
  }),
  surfaceMark: css({ width: "30%", height: "auto" }),

  row: css({
    display: "grid",
    gap: spacing[4],
    padding: { base: spacing[6], [breakpoint.md]: spacing[8] },
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
  }),
  rowTitle: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  icons: css({ display: "flex", flexWrap: "wrap", gap: spacing[4] }),
  icon: css({
    display: "grid",
    placeItems: "center",
    width: spacing[16],
    height: spacing[16],
    borderRadius: "22%",
  }),
  iconMark: css({ width: "56%", height: "auto" }),
}

/** The mark drawn inline in `currentColor`, on the 24u grid. */
export function ExplorationMark({
  exploration,
  sx,
}: {
  exploration: Exploration
  sx?: React.ComponentProps<"svg">["sx"]
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" sx={[styles.mark, sx]}>
      <g fill="currentColor" fillRule="evenodd">
        {exploration.fills.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {exploration.strokes ? (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={exploration.strokes.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {exploration.strokes.paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ) : null}
    </svg>
  )
}

/** The petal K large, at 16 to 48 px, on every surface and as an app icon in each colour pair. */
export function Explorations() {
  const current = PETAL_K
  return (
    <div sx={styles.layout}>
      <div sx={[sectionStyles.bordered, styles.detail]}>
        <div sx={styles.head}>
          <div
            sx={styles.hero}
            style={{
              background: SURFACES[0].background,
              color: SURFACES[0].foreground,
            }}
          >
            <ExplorationMark exploration={current} sx={styles.heroMark} />
          </div>
          <div sx={styles.copy}>
            <span sx={sectionStyles.eyebrow}>The mark</span>
            <span sx={styles.name}>{current.name}</span>
            <p sx={styles.idea}>{current.idea}</p>
            <ul sx={styles.formula}>
              {current.formula.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div sx={styles.sizes}>
              {[16, 24, 32, 48].map((size) => (
                <span key={size} sx={styles.sizeLabel}>
                  <ExplorationMark
                    exploration={current}
                    sx={[
                      styles.sizeMark,
                      css({ width: `${size}px`, height: `${size}px` }),
                    ]}
                  />
                  {size}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div sx={styles.surfaces}>
          {SURFACES.map((surface) => (
            <div
              key={surface.name}
              sx={styles.surface}
              style={{
                background: surface.background,
                color: surface.foreground,
              }}
            >
              <ExplorationMark exploration={current} sx={styles.surfaceMark} />
              <span sx={styles.surfaceName}>{surface.name}</span>
            </div>
          ))}
        </div>

        <div sx={styles.row}>
          <span sx={styles.rowTitle}>
            As an app icon or favicon, in any colour pair
          </span>
          <div sx={styles.icons}>
            {SURFACES.map((surface) => (
              <div
                key={surface.name}
                sx={styles.icon}
                style={{
                  background: surface.background,
                  color: surface.foreground,
                }}
              >
                <ExplorationMark exploration={current} sx={styles.iconMark} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
