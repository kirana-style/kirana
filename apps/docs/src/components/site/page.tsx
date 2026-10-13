/**
 * The frame every marketing page shares: the site header and footer, a hero in
 * the rail over a backdrop in the page's accent, and ruled sections below.
 */
import { css } from "@kirana-style/core"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { SiteFooter, SiteHeader } from "@/components/site-chrome"

import { Eyebrow } from "./accents"
import { PETAL_TILE, Rail, patterns } from "./patterns"
import { PixelField } from "./pixel-field"
import type { PixelPattern } from "./pixel-field"

export type Backdrop = "pixels" | "dots" | "petals" | "lines" | "none"

const styles = {
  hero: css({
    position: "relative",
    overflow: "hidden",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  field: css({
    maskImage:
      "radial-gradient(ellipse 60% 90% at 100% 0%, black 5%, transparent 70%)",
  }),
  corner: css({
    maskImage:
      "radial-gradient(ellipse 55% 90% at 100% 0%, black 10%, transparent 70%)",
  }),
  // The petal tile, faded out from the top right; both mask layers are kept,
  // since a mask of one layer would be tiled at the petal's size.
  petalCorner: css({
    maskImage: `${PETAL_TILE}, radial-gradient(ellipse 55% 90% at 100% 0%, black 10%, transparent 70%)`,
  }),
  // Thin accent lines fanning from the top right: the "about" backdrop.
  lines: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(115deg, transparent 0 22px, ${tint(22)} 22px 23px)`,
    maskImage:
      "radial-gradient(ellipse 60% 100% at 100% 0%, black 0%, transparent 70%)",
  }),
  glow: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `radial-gradient(50% 80% at 0% 0%, ${tint(12)}, transparent 70%)`,
  }),
  inner: css({
    position: "relative",
    display: "grid",
    gap: spacing[6],
    justifyItems: "start",
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlockStart: { base: spacing[14], [breakpoint.md]: spacing[24] },
    paddingBlockEnd: { base: spacing[12], [breakpoint.md]: spacing[20] },
  }),
  title: css({
    maxWidth: "52rem",
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["4xl"], [breakpoint.md]: fontSize["6xl"] },
    lineHeight: { base: lineHeight["4xl"], [breakpoint.md]: lineHeight["6xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tighter,
    textWrap: "balance",
  }),
  accentWord: css({ color: accent.base }),
  lede: css({
    maxWidth: "40rem",
    fontSize: { base: fontSize.lg, [breakpoint.md]: fontSize.xl },
    lineHeight: "1.6",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  actions: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
  section: css({
    // Clears the sticky site header when a link lands on a section.
    scrollMarginBlockStart: "4rem",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  sectionInner: css({
    display: "grid",
    // One column that may shrink below its content, so a wide child (a tab
    // list, a code block) scrolls inside itself instead of widening the page.
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: { base: spacing[8], [breakpoint.md]: spacing[10] },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[12], [breakpoint.md]: spacing[16] },
  }),
  // A band that fills the rail edge to edge: the same conditions as above, so
  // it replaces every entry.
  flush: css({
    paddingInline: { base: 0, [breakpoint.md]: 0 },
    paddingBlock: { base: 0, [breakpoint.md]: 0 },
  }),
  head: css({ display: "grid", gap: spacing[3], maxWidth: "44rem" }),
  sectionTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["2xl"], [breakpoint.md]: fontSize["3xl"] },
    lineHeight: { base: lineHeight["2xl"], [breakpoint.md]: lineHeight["3xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
  }),
  sectionLede: css({
    fontSize: fontSize.base,
    lineHeight: "1.7",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
}

/** Header, the page in its accent, footer. */
export function Page({
  accent: name,
  children,
}: {
  accent: AccentName
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <main sx={accents[name]}>{children}</main>
      <SiteFooter />
    </>
  )
}

export function PageHero({
  icon,
  eyebrow,
  title,
  lede,
  actions,
  backdrop = "pixels",
  pattern = "clouds",
  children,
}: {
  /** The pixel field's shape, when the backdrop is `pixels`. */
  pattern?: PixelPattern
  icon: IconProps["icon"]
  eyebrow: string
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
  backdrop?: Backdrop
  children?: React.ReactNode
}) {
  return (
    <header sx={styles.hero}>
      <Rail>
        <div sx={styles.glow} aria-hidden="true" />
        {backdrop === "pixels" ? (
          <PixelField sx={styles.field} opacity={0.55} pattern={pattern} />
        ) : backdrop === "dots" ? (
          <span sx={[patterns.dots, styles.corner]} aria-hidden="true" />
        ) : backdrop === "petals" ? (
          <span sx={[patterns.petals, styles.petalCorner]} aria-hidden="true" />
        ) : backdrop === "lines" ? (
          <span sx={styles.lines} aria-hidden="true" />
        ) : null}
        <div sx={styles.inner}>
          <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
          <h1 sx={styles.title}>{title}</h1>
          {lede ? <p sx={styles.lede}>{lede}</p> : null}
          {actions ? <div sx={styles.actions}>{actions}</div> : null}
          {children}
        </div>
      </Rail>
    </header>
  )
}

/** A word of a title in the page's accent. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <span sx={styles.accentWord}>{children}</span>
}

export function PageSection({
  id,
  title,
  lede,
  flush,
  sx,
  children,
}: {
  id?: string
  title?: React.ReactNode
  lede?: React.ReactNode
  /** No padding: for a band that should meet the rail's lines. */
  flush?: boolean
  sx?: Sx
  children?: React.ReactNode
}) {
  return (
    <section id={id} sx={styles.section}>
      <Rail sx={[styles.sectionInner, flush ? styles.flush : null, sx]}>
        {title || lede ? (
          <div sx={styles.head}>
            {title ? <h2 sx={styles.sectionTitle}>{title}</h2> : null}
            {lede ? <p sx={styles.sectionLede}>{lede}</p> : null}
          </div>
        ) : null}
        {children}
      </Rail>
    </section>
  )
}
