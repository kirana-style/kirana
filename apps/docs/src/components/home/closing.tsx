/**
 * How the homepage ends: the Platinum and Gold sponsors, or empty places for
 * them, questions
 * grouped by topic, and a blueprint card — the mark's construction drawing in
 * white on the accent — with the ways in.
 */
import { Link } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"
import { FavouriteIcon, HelpCircleIcon } from "@hugeicons/core-free-icons"

import { accent } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
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
import { FaqGroups } from "@/components/site/faq"
import { Rail } from "@/components/site/patterns"
import { SPONSORS } from "@/components/sponsors/data"
import { SponsorLogo, SponsorVacancy } from "@/components/site/sponsor-slots"

import { HomeSection } from "./frame"
import { LISTS, sentence } from "@/data/facts"

/** Every answer is stated, with its source, on the linked page. */
const FAQ: {
  topic: string
  items: { q: string; a: string; href: string; link: string }[]
}[] = [
  {
    topic: "Getting started",
    items: [
      {
        q: "Can I install it from npm?",
        a: "Not yet. Kirana is a v0.1.0 pre-release. The packages are packed and install-tested on every change, and until they are published you install them from tarballs.",
        href: "/docs/start/installation",
        link: "Installation",
      },
      {
        q: "Which frameworks and bundlers does it support?",
        a: `${sentence(LISTS.frameworks)}, and plain class strings; server templates in ${sentence(LISTS.serverFrameworks)}; ${sentence(LISTS.bundlers)}, and Turbopack through Next.js. kirana init sets any of them up from a diff.`,
        href: "/docs/integrations/ecosystem",
        link: "Ecosystem and status",
      },
      {
        q: "Can I move an existing Tailwind or StyleX project?",
        a: "kirana migrate tailwind rewrites class strings, cn and cva; kirana migrate stylex maps create, defineVars and markers. Both print a diff and a report, and write nothing until you pass --write.",
        href: "/docs/migration/from-tailwind",
        link: "Migrating from Tailwind",
      },
    ],
  },
  {
    topic: "How it works",
    items: [
      {
        q: "Without a class list, how do I see what an element gets?",
        a: "Your editor shows it. The language server writes each element's CSS at the end of its line, coloured by kind, and a hover shows the box model, every declaration and the compiled rule — read from the same compiler session the build uses.",
        href: "/docs/tooling/editor",
        link: "Editor support",
      },
      {
        q: "Does anything run in the browser?",
        a: "Not for static styles: they compile to a stylesheet and class names. A value known only at runtime goes through a helper under 1 kB, and only in the modules that have one.",
        href: "/docs/styling/dynamic",
        link: "Dynamic styles",
      },
      {
        q: "How is dark mode done without a dark variant?",
        a: "Each colour is one light-dark() pair, so the browser picks the side from color-scheme. There is no second stylesheet and no class to toggle.",
        href: "/docs/tokens/themes-and-modes",
        link: "Themes and modes",
      },
      {
        q: "How does it differ from StyleX?",
        a: "The authoring model is close to one-to-one. Merging is per entry — a later style replaces the entries it names and keeps the rest, where StyleX replaced the whole property — and relations are declared, so the compiler checks both ends.",
        href: "/docs/migration/from-stylex",
        link: "Migrating from StyleX",
      },
    ],
  },
  {
    topic: "The project",
    items: [
      {
        q: "What licence is it under?",
        a: "MIT, for the compiler and every package. Sponsorship pays for maintenance; it does not buy features away from anyone.",
        href: "/sponsors",
        link: "Sponsors",
      },
      {
        q: "Can my AI tools read these docs?",
        a: "Yes: llms.txt, llms-full.txt and a markdown twin of every page, with Copy page and Open in ChatGPT or Claude on each. Two agent skills, installed with npx skills add, teach an agent to write Kirana and to migrate to it.",
        href: "/docs/project/llms",
        link: "Docs for language models",
      },
    ],
  },
]

const styles = {
  answerLink: css({
    color: theme.foreground,
    fontWeight: fontWeight.medium,
    textDecorationLine: "underline",
    textDecorationStyle: "dashed",
    textUnderlineOffset: "4px",
  }),

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

  // A deep blue in both schemes, so white stays readable on it.
  ground: css({
    [accent.base]: "light-dark(oklch(0.49 0.22 264), oklch(0.44 0.2 264))",
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
  cta: css({
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gap: spacing[8],
    alignItems: "center",
    borderRadius: radius.xl,
    backgroundColor: accent.base,
    color: accent.on,
    padding: { base: spacing[8], [breakpoint.md]: spacing[12] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) minmax(0, 20rem)",
    },
  }),
  // A blueprint grid under everything, in the text colour.
  ctaGrid: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    maskImage: "linear-gradient(to right, transparent, black 70%)",
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
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    textWrap: "balance",
  }),
  ctaText: css({
    maxWidth: "32rem",
    fontSize: fontSize.base,
    lineHeight: "1.65",
    opacity: 0.85,
  }),
  ctaActions: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[3],
    paddingBlockStart: spacing[2],
  }),
  ctaPrimary: css({
    backgroundColor: { base: "white", ":hover": "rgb(255 255 255 / 0.9)" },
    color: "black",
  }),
  ctaSecondary: css({
    borderColor: "rgb(255 255 255 / 0.4)",
    backgroundColor: {
      base: "transparent",
      ":hover": "rgb(255 255 255 / 0.12)",
    },
    color: "white",
  }),
  // In the card's own colour, `accent.on`.
  drawing: css({ position: "relative", maxWidth: "17rem", opacity: 0.9 }),
}

export function Sponsors() {
  // Platinum first, then Gold, then Silver: the tiers whose logo is on the homepage.
  const gold = [
    ...SPONSORS.filter((sponsor) => sponsor.tier === "Platinum sponsor"),
    ...SPONSORS.filter((sponsor) => sponsor.tier === "Gold sponsor"),
    ...SPONSORS.filter((sponsor) => sponsor.tier === "Silver sponsor"),
  ]
  // Always four places: the sponsors there are, then vacancies.
  const vacancies = Math.max(0, 4 - gold.length)
  return (
    <HomeSection
      accent="pink"
      icon={FavouriteIcon}
      eyebrow="Sponsors"
      title={gold.length > 0 ? "Backed by" : "Back the compiler you build on"}
      lede={
        gold.length > 0
          ? undefined
          : "Kirana is MIT licensed and free to use. A Gold sponsor's logo sits here, beside every docs page and in the README — and buys maintenance, not control."
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

export function Faq() {
  return (
    <HomeSection
      accent="emerald"
      icon={HelpCircleIcon}
      eyebrow="Questions"
      title="Asked before you ask"
    >
      <FaqGroups
        groups={FAQ.map((group) => ({
          topic: group.topic,
          items: group.items.map((item) => ({
            title: item.q,
            body: (
              <>
                <p>{item.a}</p>
                <DocsLink href={item.href} sx={styles.answerLink}>
                  {item.link}
                </DocsLink>
              </>
            ),
          })),
        }))}
      />
    </HomeSection>
  )
}

export function Blueprint() {
  return (
    <section sx={[styles.ctaWrap, styles.ground]}>
      <Rail sx={styles.ctaInner}>
        <div sx={styles.cta}>
          <div sx={styles.ctaGrid} aria-hidden="true" />
          <div sx={styles.ctaCopy}>
            <h2 sx={styles.ctaTitle}>Built on a grid you can check.</h2>
            <p sx={styles.ctaText}>
              Like the mark beside this, every style has a stated rule behind
              it. Start with the quick start, or see what the compiler made of
              the examples.
            </p>
            <div sx={styles.ctaActions}>
              <Button
                size="lg"
                nativeButton={false}
                sx={styles.ctaPrimary}
                render={
                  <DocsLink href="/docs/start/quick-start">
                    Quick start
                  </DocsLink>
                }
              />
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                sx={styles.ctaSecondary}
                render={
                  <Link
                    to="/play"
                    search={{ example: undefined }}
                    {...styleProps()}
                  >
                    Open the playground
                  </Link>
                }
              />
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
