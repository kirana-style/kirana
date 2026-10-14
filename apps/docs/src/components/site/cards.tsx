/**
 * Cards the marketing pages share: a linked card with a keycap, a grid for
 * them, numbered steps on a rail, and a strip of measured figures.
 */
import { css } from "@kirana-style/core"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import type { IconProps } from "@workspace/ui/primitives/icon"
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

import { Keycap } from "./accents"
import { LIFT, REST } from "@/components/site/lift"

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(var(--cols, 3), minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":is(a):hover": LIFT },
    backgroundColor: theme.card,
    padding: spacing[6],
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  title: css({
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
  }),
  text: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  meta: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: accent.base,
  }),

  steps: css({ display: "grid" }),
  step: css({
    position: "relative",
    display: "grid",
    gridTemplateColumns: "2.5rem minmax(0, 1fr)",
    columnGap: spacing[4],
    paddingBlockEnd: { base: spacing[8], ":last-child": "0" },
  }),
  stepRail: css({
    position: "absolute",
    insetBlock: `${spacing[10]} 0`,
    insetInlineStart: "1.25rem",
    width: "1px",
    backgroundColor: theme.border,
  }),
  stepNumber: css({
    display: "grid",
    placeItems: "center",
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tint(35),
    backgroundColor: tint(10),
    color: accent.base,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  }),
  stepBody: css({
    display: "grid",
    gap: spacing[1],
    paddingBlockStart: spacing[2],
  }),

  figures: css({
    display: "grid",
    gap: "1px",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  figure: css({
    display: "grid",
    gap: spacing[1],
    alignContent: "start",
    padding: spacing[5],
    backgroundColor: theme.card,
  }),
  figureValue: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize["3xl"],
    lineHeight: lineHeight["3xl"],
    fontWeight: fontWeight.semibold,
    color: accent.base,
  }),
}

export function CardGrid({
  cols = 3,
  sx,
  children,
}: {
  cols?: 2 | 3 | 4
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <div
      sx={[styles.grid, sx]}
      style={{ "--cols": cols } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

export function Card({
  icon,
  title,
  meta,
  href,
  sx,
  children,
}: {
  icon?: IconProps["icon"]
  title: React.ReactNode
  meta?: React.ReactNode
  href?: string
  sx?: Sx
  children?: React.ReactNode
}) {
  const body = (
    <>
      {icon ? <Keycap icon={icon} /> : null}
      <span sx={styles.title}>{title}</span>
      {meta ? <span sx={styles.meta}>{meta}</span> : null}
      {children ? <span sx={styles.text}>{children}</span> : null}
    </>
  )
  return href ? (
    <DocsLink href={href} sx={[styles.card, sx]}>
      {body}
    </DocsLink>
  ) : (
    <div sx={[styles.card, sx]}>{body}</div>
  )
}

export function Steps({
  items,
  start = 1,
}: {
  items: readonly { title: React.ReactNode; text: React.ReactNode }[]
  /** The first step's number, for a list split across columns. */
  start?: number
}) {
  return (
    <ol sx={styles.steps} start={start}>
      {items.map((item, i) => (
        <li key={i} sx={styles.step}>
          {i < items.length - 1 ? (
            <span sx={styles.stepRail} aria-hidden="true" />
          ) : null}
          <span sx={styles.stepNumber}>{start + i}</span>
          <div sx={styles.stepBody}>
            <span sx={styles.title}>{item.title}</span>
            <span sx={styles.text}>{item.text}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Figures({
  items,
}: {
  items: readonly { value: string; label: React.ReactNode }[]
}) {
  return (
    <div sx={styles.figures}>
      {items.map((item, i) => (
        <div key={i} sx={styles.figure}>
          <span sx={styles.figureValue}>{item.value}</span>
          <span sx={styles.text}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
