/**
 * The site's card: a picture on top (a scene from the illustration kit on its grid and glow),
 * then the title, a line of text, whatever the card lists, and pill links. The scene rises a
 * little on hover. The title is in the sans: the serif is for headings from 1.5rem up, where a
 * small bold serif beside a coloured icon read as decoration.
 *
 * Every card section on the site is built from it (the docs home's ways in, the
 * homepage's paths, packages and choices), so they read as one family. Wide cards
 * put the picture beside the text from `sm` up.
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint, pointer } from "@workspace/ui/tokens/breakpoints"
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

import { DocsLink } from "@/components/docs-link"
import { Stage } from "@/components/site/visuals"
import { LIFT, REST } from "@workspace/ui/recipes/lift"

const REDUCED = "@media (prefers-reduced-motion: reduce)"

const styles = {
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
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  wide: css({
    gridColumn: { [breakpoint.sm]: "1 / -1" },
    gridTemplateRows: { [breakpoint.sm]: "none" },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "minmax(0, 1.15fr) minmax(0, 1fr)",
    },
  }),
  art: css({
    height: "11rem",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    backgroundColor: theme.background,
  }),
  artTall: css({ height: "14rem" }),
  artWide: css({
    height: { base: "11rem", [breakpoint.sm]: "100%" },
    minHeight: { [breakpoint.sm]: "13rem" },
    borderBlockEndWidth: { [breakpoint.sm]: "0" },
    borderInlineEndWidth: { [breakpoint.sm]: "1px" },
    borderInlineEndStyle: "solid",
    borderInlineEndColor: theme.border,
  }),
  // The whole scene rises while its card is hovered.
  rise: css({
    transitionProperty: "translate",
    transitionDuration: { base: duration[300], [REDUCED]: "0s" },
    translate: { base: "0 0", ":is([data-card]:hover *)": "0 -4px" },
  }),
  body: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[2],
    padding: { base: spacing[4], [breakpoint.md]: spacing[5] },
  }),
  title: css({
    display: "flex",
    alignItems: "baseline",
    gap: spacing[2],
    fontSize: textSize.subheading,
    lineHeight: textLeading.subheading,
    letterSpacing: textTracking.subheading,
    fontWeight: fontWeight.semibold,
    color: { base: theme.foreground, ":is(a):hover": accent.base },
    textDecorationLine: "none",
  }),
  note: css({
    marginInlineStart: "auto",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  text: css({
    fontSize: fontSize.sm,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
  links: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing["1.5"],
    marginBlockStart: spacing[2],
    padding: 0,
    listStyleType: "none",
  }),
}

/** A rounded link with an arrow: the cards' way onward. */
export const pill = css({
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[1],
  height: spacing[7],
  // A finger's height on a touch screen.
  minHeight: { [pointer.coarse]: "2.75rem" },
  paddingInline: spacing["2.5"],
  borderRadius: radius.full,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: { base: theme.border, ":hover": tint(40) },
  backgroundColor: { base: theme.background, ":hover": tint(8) },
  fontSize: fontSize.xs,
  lineHeight: lineHeight.xs,
  fontWeight: fontWeight.medium,
  color: { base: theme.foreground, ":hover": accent.base },
  textDecorationLine: "none",
  whiteSpace: "nowrap",
  transitionProperty: "border-color, background-color, color",
  transitionDuration: duration[150],
})

export type CardLink = { title: React.ReactNode; href: string }

export function PillLinks({ links }: { links: readonly CardLink[] }) {
  return (
    <ul sx={styles.links}>
      {links.map((link) => (
        <li key={link.href}>
          <DocsLink href={link.href} sx={pill}>
            {link.title}
            <Icon icon={ArrowRight01Icon} size="0.75rem" />
          </DocsLink>
        </li>
      ))}
    </ul>
  )
}

export function IllustratedCard({
  tone,
  art,
  wide,
  tall,
  title,
  note,
  href,
  text,
  links,
  sx,
  children,
}: {
  /** A hue of its own, for a card that leads to a page in another scene; else the page's. */
  tone?: AccentName
  /** The scene, drawn on the stage's grid and glow. */
  art: React.ReactNode
  wide?: boolean
  /** A taller picture, for a scene with more in it (a code window). */
  tall?: boolean
  title: React.ReactNode
  /** A quiet mono note at the title's end: a count, a step. */
  note?: React.ReactNode
  href?: string
  text?: React.ReactNode
  links?: readonly CardLink[]
  sx?: Sx
  children?: React.ReactNode
}) {
  const heading = (
    <>
      {title}
      {note ? <span sx={styles.note}>{note}</span> : null}
    </>
  )
  return (
    <section
      data-card=""
      sx={[
        tone ? accents[tone] : null,
        styles.card,
        wide ? styles.wide : null,
        sx,
      ]}
    >
      <div
        sx={[
          styles.art,
          tall ? styles.artTall : null,
          wide ? styles.artWide : null,
        ]}
      >
        <Stage>
          <div sx={styles.rise}>{art}</div>
        </Stage>
      </div>
      <div sx={styles.body}>
        {href ? (
          <DocsLink href={href} sx={styles.title}>
            {heading}
          </DocsLink>
        ) : (
          <h3 sx={styles.title}>{heading}</h3>
        )}
        {text ? <p sx={styles.text}>{text}</p> : null}
        {children}
        {links ? <PillLinks links={links} /> : null}
      </div>
    </section>
  )
}
