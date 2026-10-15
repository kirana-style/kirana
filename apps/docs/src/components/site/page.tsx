/**
 * The frame every marketing page shares: the site header and footer, a hero with the page's scene
 * dissolving into the paper beside it, and numbered chapters below. A page names its scene once
 * (`apps/docs/src/brand/scenes.ts`); its hue, its hero picture and its footer follow from it.
 */
import { css } from "@kirana-style/core"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { SCENES } from "@/brand/scenes"
import type { SceneId } from "@/brand/scenes"
import { SiteFooter, SiteHeader } from "@/components/site-chrome"

import { Chapter, chapter } from "./chapter"
import { Rail } from "./patterns"
import { SceneProvider, useScene } from "./scene-context"
import { ScenePixels } from "./scene-pixels"

const styles = {
  hero: css({
    position: "relative",
    overflow: "hidden",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  heroRail: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
  }),
  // Beside the words from `lg` up, dissolving left into them; a band under them on a phone.
  scene: css({
    position: { base: "relative", [breakpoint.lg]: "absolute" },
    order: { base: 2, [breakpoint.lg]: 0 },
    insetBlock: { [breakpoint.lg]: 0 },
    insetInlineEnd: { [breakpoint.lg]: 0 },
    insetInlineStart: { [breakpoint.lg]: "auto" },
    width: { base: "100%", [breakpoint.lg]: "50%", [breakpoint.xl]: "54%" },
    height: {
      base: "12rem",
      [breakpoint.sm]: "15rem",
      [breakpoint.lg]: "auto",
    },
  }),
  inner: css({
    position: "relative",
    display: "grid",
    gap: spacing[6],
    justifyItems: "start",
    // The words keep to the half the scene leaves them, so no pixel lands among them on a
    // tablet, where 37rem would reach past the middle.
    maxWidth: {
      [breakpoint.lg]: "min(37rem, 50%)",
      [breakpoint.xl]: "min(37rem, 46%)",
    },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlockStart: { base: spacing[14], [breakpoint.md]: spacing[24] },
    paddingBlockEnd: { base: spacing[8], [breakpoint.lg]: spacing[24] },
  }),
  label: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["2.5"],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.foreground,
  }),
  // One pixel of the page's hue: the scene's colour, in the motif's unit.
  pixel: css({
    width: "0.5rem",
    height: "0.5rem",
    backgroundColor: accent.base,
  }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.display2,
    lineHeight: textLeading.display2,
    letterSpacing: textTracking.display2,
    fontWeight: fontWeight.normal,
    textWrap: "balance",
  }),
  accentWord: css({ fontStyle: "italic", color: accent.base }),
  lede: css({
    fontSize: textSize.lede,
    lineHeight: textLeading.lede,
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
    gap: { base: spacing[8], [breakpoint.md]: spacing[12] },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[14], [breakpoint.md]: spacing[20] },
  }),
  // A band that fills the rail edge to edge: the same conditions as above, so
  // it replaces every entry.
  flush: css({
    paddingInline: { base: 0, [breakpoint.md]: 0 },
    paddingBlock: { base: 0, [breakpoint.md]: 0 },
  }),
  head: css({ display: "grid", gap: spacing[4] }),
}

/** Header, the page in its scene's hue, footer. */
export function Page({
  scene,
  children,
}: {
  scene: SceneId
  children: React.ReactNode
}) {
  return (
    <SceneProvider value={scene}>
      <SiteHeader />
      <main sx={accents[SCENES[scene].hue]}>{children}</main>
      <SiteFooter />
    </SceneProvider>
  )
}

export function PageHero({
  label,
  title,
  lede,
  actions,
  children,
}: {
  /** The page's name, above its headline. */
  label: string
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const scene = useScene()
  return (
    <header sx={styles.hero}>
      <Rail sx={styles.heroRail}>
        <ScenePixels
          scene={scene}
          dissolve="hero"
          fade={0.72}
          sx={styles.scene}
        />
        <div sx={styles.inner}>
          <p sx={styles.label}>
            <span sx={styles.pixel} aria-hidden="true" />
            {label}
          </p>
          <h1 sx={styles.title}>{title}</h1>
          {lede ? <p sx={styles.lede}>{lede}</p> : null}
          {actions ? <div sx={styles.actions}>{actions}</div> : null}
          {children}
        </div>
      </Rail>
    </header>
  )
}

/** The one word of a page's headline set in italic, in the page's hue. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <em sx={styles.accentWord}>{children}</em>
}

export function PageSection({
  id,
  number,
  label,
  title,
  lede,
  aside,
  flush,
  sx,
  children,
}: {
  id?: string
  /** The chapter's number on its page: "01". */
  number?: string
  /** The chapter's name, in two or three words. */
  label?: React.ReactNode
  title?: React.ReactNode
  lede?: React.ReactNode
  /** A link at the end of the label row. */
  aside?: React.ReactNode
  /** No padding: for a band that should meet the rail's lines. */
  flush?: boolean
  sx?: Sx
  children?: React.ReactNode
}) {
  return (
    <section id={id} sx={styles.section}>
      <Rail sx={[styles.sectionInner, flush ? styles.flush : null, sx]}>
        {label && title ? (
          <Chapter
            number={number}
            label={label}
            title={title}
            lede={lede}
            aside={aside}
          />
        ) : title || lede ? (
          <div sx={styles.head}>
            {title ? <h2 sx={chapter.title}>{title}</h2> : null}
            {lede ? <p sx={chapter.lede}>{lede}</p> : null}
          </div>
        ) : null}
        {children}
      </Rail>
    </section>
  )
}
