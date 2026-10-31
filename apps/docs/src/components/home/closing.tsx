/**
 * How the homepage ends: the Platinum, Gold and Silver sponsors, or empty places
 * for them, and a blueprint card (the mark's construction drawing in white on one of
 * Kirana's landscapes) with the ways in.
 */
import { css } from "@kirana-style/core"

import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { Plan } from "@/components/brand/mark-plan"
import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { QuickStart, SecondaryCta } from "@/components/site/cta"
import { Rail } from "@/components/site/patterns"
import { ScenePixels } from "@/components/site/scene-pixels"
import { SPONSORS } from "@/components/sponsors/data"
import { PLAYGROUND } from "@/data/links"
import { SponsorLogo, SponsorVacancy } from "@/components/site/sponsor-slots"

import { HomeSection } from "./frame"

/** The night ground and the paper, fixed: the card is dark in both schemes. */
const NIGHT = "oklch(0.165 0.008 70)"
const PAPER = "oklch(0.988 0.004 85)"

const styles = {
  sponsors: css({
    display: "grid",
    gap: spacing[3],
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  sponsorLinks: css({
    display: "flex",
    flexWrap: "wrap",
    gap: { base: spacing[4], [breakpoint.md]: spacing[6] },
    marginBlockStart: spacing[5],
  }),

  ctaWrap: css({
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  ctaInner: css({
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[14], [breakpoint.md]: spacing[20] },
  }),
  // A night ground in both schemes, with sunrise over the hills dissolving into it from the
  // right; the words sit on the night side in the paper's colour.
  cta: css({
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gap: spacing[8],
    alignItems: "center",
    isolation: "isolate",
    borderRadius: radius.xl,
    backgroundColor: NIGHT,
    color: PAPER,
    padding: { base: spacing[8], [breakpoint.md]: spacing[12] },
    paddingBlockEnd: { base: "11rem", [breakpoint.md]: spacing[12] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) minmax(0, 20rem)",
    },
  }),
  // Right of the words from `md` up, dissolving left towards them; on a phone, a low band under
  // the buttons, in room the card keeps for it, so no pixel lands among the words.
  ctaScene: css({
    zIndex: -1,
    insetInlineStart: { base: 0, [breakpoint.md]: "46%" },
    insetBlockStart: { base: "auto", [breakpoint.md]: 0 },
    height: { base: "11rem", [breakpoint.md]: "100%" },
  }),
  ctaCopy: css({
    position: "relative",
    display: "grid",
    gap: spacing[4],
    justifyItems: "start",
  }),
  ctaTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["3xl"], [breakpoint.md]: fontSize["5xl"] },
    lineHeight: { base: lineHeight["3xl"], [breakpoint.md]: lineHeight["5xl"] },
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
    // Two lines on the night side whatever the face's width: on one line it runs under the drawing.
    maxWidth: "10.5em",
  }),
  ctaText: css({
    maxWidth: "32rem",
    fontSize: fontSize.base,
    lineHeight: "1.65",
    color: `color-mix(in oklab, ${PAPER} 82%, transparent)`,
  }),
  ctaActions: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[3],
    paddingBlockStart: spacing[2],
  }),
  // The night's raised surface, as the other Quick start pills are a shade off their ground.
  ctaPrimary: css({
    backgroundColor: {
      base: `color-mix(in oklab, ${PAPER} 12%, ${NIGHT})`,
      ":hover": `color-mix(in oklab, ${PAPER} 18%, ${NIGHT})`,
    },
    // Both entries: the pill's own border darkens on hover, which on the night would read as ink.
    borderColor: {
      base: `color-mix(in oklab, ${PAPER} 14%, transparent)`,
      ":hover": `color-mix(in oklab, ${PAPER} 26%, transparent)`,
    },
    color: PAPER,
  }),
  // Paper on the night in every state: the outline button darkens its text on `:hover`, so the
  // override names `:hover` too (Kirana merges per condition).
  ctaSecondary: css({
    borderColor: {
      base: `color-mix(in oklab, ${PAPER} 40%, transparent)`,
      ":hover": `color-mix(in oklab, ${PAPER} 70%, transparent)`,
    },
    backgroundColor: {
      base: `color-mix(in oklab, ${PAPER} 6%, transparent)`,
      ":hover": `color-mix(in oklab, ${PAPER} 16%, transparent)`,
    },
    color: { base: PAPER, ":hover": PAPER },
  }),
  // In the card's text colour, the paper. Beside the words from `md` up; a phone has no room
  // for it beside them, and under them it would cover the scene.
  drawing: css({
    position: "relative",
    maxWidth: "17rem",
    display: { base: "none", [breakpoint.md]: "block" },
  }),
}

export function Sponsors() {
  // Platinum first, then Gold, then Silver: the tiers whose logo is on the homepage.
  const gold = [
    ...SPONSORS.filter((sponsor) => sponsor.tier === "Platinum sponsor"),
    ...SPONSORS.filter((sponsor) => sponsor.tier === "Gold sponsor"),
    ...SPONSORS.filter((sponsor) => sponsor.tier === "Silver sponsor"),
  ]
  // At least four places: the sponsors there are, then vacancies.
  const vacancies = Math.max(0, 4 - gold.length)
  return (
    <HomeSection
      accent="ochre"
      number="08"
      eyebrow="Sponsors"
      title={gold.length > 0 ? "Backed by" : "Back the compiler you build on"}
      lede={
        gold.length > 0
          ? undefined
          : "Kirana is MIT licensed and free to use. A Gold sponsor's logo sits here, beside every docs page and in the README, and it buys maintenance, not control."
      }
    >
      <div sx={styles.sponsors}>
        {gold.map((sponsor) => (
          <SponsorLogo key={sponsor.name} sponsor={sponsor} />
        ))}
        {Array.from({ length: vacancies }, (_, i) => (
          <SponsorVacancy key={i} />
        ))}
      </div>
      <div sx={styles.sponsorLinks}>
        <DocsLink href="/sponsors#tiers">
          <More>Become a sponsor</More>
        </DocsLink>
        <DocsLink href="/sponsors#terms">
          <More>What it covers, and what it does not</More>
        </DocsLink>
      </div>
    </HomeSection>
  )
}

export function Blueprint() {
  return (
    <section sx={styles.ctaWrap}>
      <Rail sx={styles.ctaInner}>
        <div sx={styles.cta}>
          <ScenePixels
            scene="misty-hills"
            dissolve="left"
            fade={0.55}
            sx={styles.ctaScene}
          />
          <div sx={styles.ctaCopy}>
            <h2 sx={styles.ctaTitle}>
              From your first style to the CSS you ship.
            </h2>
            <p sx={styles.ctaText}>
              Every class Kirana writes comes from a line of your source, and
              your editor shows which. Start with the quick start, or compile a
              project of your own in the playground, in your browser.
            </p>
            <div sx={styles.ctaActions}>
              <QuickStart sx={styles.ctaPrimary} />
              <SecondaryCta
                sx={styles.ctaSecondary}
                render={<DocsLink href={PLAYGROUND} />}
              >
                Open the playground
              </SecondaryCta>
            </div>
          </div>
          <Plan
            // The quiet layers only: the full construction, with its circles, radii and joins,
            // is on /brand/mark.
            layers={{
              grid: true,
              ghost: true,
              outline: true,
              dimensions: true,
            }}
            label="The Kirana mark, drawn on its construction grid"
            mono
            sx={styles.drawing}
          />
        </div>
      </Rail>
    </section>
  )
}
