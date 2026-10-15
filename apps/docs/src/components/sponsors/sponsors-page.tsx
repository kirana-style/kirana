import { css } from "@kirana-style/core"
import {
  Bug01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  CodeIcon,
  FavouriteIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration, easing } from "@workspace/ui/tokens/motion"
import { shadow } from "@workspace/ui/tokens/shadows"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { More, sectionStyles } from "@/components/page-section"
import { FaqGroups } from "@/components/site/faq"
import { Accent, PageHero, PageSection } from "@/components/site/page"

import { CHANNELS, FAQ, GOALS, SPONSORS, TERMS, TIERS } from "./data"
import type { Channel, Tier } from "./data"
import { LIFT, REST } from "@workspace/ui/recipes/lift"

/** The Platinum tier's edge: a cool grey, lighter on a dark page. */
const PLATINUM = "light-dark(oklch(0.62 0.03 255), oklch(0.8 0.03 255))"

const styles = {
  // Tiers
  tierBar: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    justifyContent: "space-between",
    gap: spacing[4],
  }),
  group: css({ display: "grid", gap: spacing[4] }),
  groupTitle: css({
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.semibold,
  }),
  tiers: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  // Bronze, Silver, Gold and Partner: one row on wide screens, two by two below.
  tiersFour: css({
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.xl]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  tier: css({
    position: "relative",
    display: "grid",
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    boxShadow: { base: "none", ":hover": shadow.md },
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
    transitionTimingFunction: easing.inOut,
  }),
  featured: css({
    borderColor: theme.foreground,
    boxShadow: { base: `0 0 0 1px ${theme.foreground}`, ":hover": shadow.md },
  }),
  recommended: css({
    borderRadius: radius.full,
    backgroundColor: theme.foreground,
    color: theme.background,
    paddingInline: spacing["2.5"],
    paddingBlock: spacing["0.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.semibold,
  }),
  tierTop: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    minHeight: spacing[6],
  }),
  tierHead: css({ display: "grid", gap: spacing[3], maxWidth: "44rem" }),
  tierHeadTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["2xl"], [breakpoint.md]: fontSize["3xl"] },
    lineHeight: { base: lineHeight["2xl"], [breakpoint.md]: lineHeight["3xl"] },
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
  }),
  tierKind: css({
    fontSize: "0.6875rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  tierBody: css({
    display: "grid",
    gridTemplateRows: "auto auto auto 1fr auto",
    gap: spacing[4],
    padding: spacing[6],
  }),
  tierName: css({
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.semibold,
  }),
  tierText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  price: css({ display: "grid", gap: spacing["0.5"] }),
  priceLabel: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.mutedForeground,
  }),
  priceValue: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize["3xl"],
    lineHeight: lineHeight["3xl"],
    fontWeight: fontWeight.semibold,
  }),
  // "Let's talk" and "You choose" are words, not figures: the heading face.
  priceWords: css({
    fontFamily: fontFamily.heading,
    fontWeight: fontWeight.normal,
  }),
  pricePer: css({
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  benefits: css({ display: "grid", gap: spacing[2], alignContent: "start" }),
  benefit: css({
    display: "flex",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: "1.5",
  }),
  tick: css({ marginBlockStart: "0.15em", color: theme.foreground }),

  // The top tier: the whole row, the benefits beside the price, and a cool
  // metallic edge that reads as a step above the rest in either scheme.
  platinum: css({
    gridColumn: { [breakpoint.md]: "1 / -1" },
    borderColor: PLATINUM,
    boxShadow: { base: `0 0 0 1px ${PLATINUM}`, ":hover": shadow.md },
    backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${PLATINUM} 16%, transparent), transparent 55%)`,
  }),
  platinumBody: css({
    gridTemplateRows: { base: "none", [breakpoint.md]: "none" },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "minmax(0, 1fr) minmax(0, 1.25fr)",
    },
    columnGap: spacing[10],
    alignItems: "start",
  }),
  platinumLead: css({
    display: "grid",
    gap: spacing[4],
    justifyItems: "start",
  }),
  platinumBadge: css({
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: PLATINUM,
    paddingInline: spacing["2.5"],
    paddingBlock: spacing["0.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.semibold,
  }),

  // Channels
  channelGroups: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  channelGroup: css({
    display: "grid",
    gridTemplateRows: "auto 1fr",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    overflow: "hidden",
  }),
  channelHead: css({
    display: "grid",
    gap: spacing[1],
    padding: spacing[5],
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
  }),
  channelList: css({ display: "grid", alignContent: "start" }),
  channel: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingInline: spacing[5],
    paddingBlock: spacing[4],
    borderTopWidth: { base: "1px", ":first-child": "0" },
    borderTopStyle: "solid",
    borderTopColor: theme.border,
  }),
  channelText: css({ display: "grid", gap: spacing["0.5"] }),
  channelName: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),

  // Goals
  goals: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  goal: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    padding: spacing[6],
  }),
  step: css({
    display: "grid",
    placeItems: "center",
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.full,
    backgroundColor: alpha.primary20,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  goalList: css({
    display: "grid",
    gap: spacing[2],
    paddingInlineStart: spacing[4],
    listStyleType: "disc",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),

  // Wall
  wallTier: css({ display: "grid", gap: spacing[3] }),
  logos: css({
    display: "grid",
    gap: spacing[3],
    gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
  }),
  logosLarge: css({
    gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
  }),
  slot: css({
    display: "grid",
    placeItems: "center",
    minHeight: spacing[24],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    padding: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
    textAlign: "center",
    textDecorationLine: "none",
    transitionProperty: "box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
  }),
  slotLarge: css({ minHeight: spacing[32] }),
  // Platinum: one or two across the full width, the tallest places.
  logosPlatinum: css({
    display: "grid",
    gap: spacing[3],
    gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
  }),
  slotPlatinum: css({ minHeight: spacing[40], borderColor: PLATINUM }),
  filled: css({
    borderStyle: "solid",
    backgroundColor: theme.card,
    color: theme.foreground,
  }),
  logo: css({ maxWidth: "100%", maxHeight: spacing[12] }),
  avatars: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
  avatar: css({
    display: "grid",
    placeItems: "center",
    width: spacing[14],
    height: spacing[14],
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: theme.border,
    color: theme.mutedForeground,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
  }),

  // Other ways to help
  helps: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  help: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    borderRadius: radius.xl,
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    padding: spacing[6],
    textDecorationLine: "none",
    color: theme.foreground,
  }),
  iconBadge: css({
    display: "grid",
    placeItems: "center",
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.lg,
    backgroundColor: alpha.primary20,
  }),
  helpTitle: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
  }),
}

const usd = new Intl.NumberFormat("en-US")

function Price({ tier }: { tier: Tier }) {
  if (!tier.amount)
    return (
      <div sx={styles.price}>
        <span sx={styles.priceLabel}>Amount</span>
        <span sx={[styles.priceValue, styles.priceWords]}>
          {tier.kind === "Custom" ? "Let's talk" : "You choose"}
        </span>
      </div>
    )
  return (
    <div sx={styles.price}>
      <span sx={styles.priceLabel}>Starts at</span>
      <span sx={styles.priceValue}>
        {`$${usd.format(tier.amount)}`}{" "}
        <span sx={styles.pricePer}>/ {tier.period ?? "month"}</span>
      </span>
    </div>
  )
}

/** The top tier, across the row: what it is and costs on the left, what it gives on the right. */
function PlatinumCard({ tier }: { tier: Tier }) {
  return (
    <article sx={[sectionStyles.bordered, styles.tier, styles.platinum]}>
      <div sx={[styles.tierBody, styles.platinumBody]}>
        <div sx={styles.platinumLead}>
          <div sx={styles.tierTop}>
            <span sx={styles.tierKind}>Yearly</span>
            <span sx={styles.platinumBadge}>Top tier</span>
          </div>
          <h4 sx={styles.tierName}>{tier.name}</h4>
          <p sx={styles.tierText}>{tier.text}</p>
          <Price tier={tier} />
          <Button
            nativeButton={false}
            render={<a href="#companies">Talk to us</a>}
          />
        </div>
        <ul sx={styles.benefits}>
          {tier.benefits.map((benefit) => (
            <li key={benefit} sx={styles.benefit}>
              <Icon icon={Tick02Icon} size="1rem" sx={styles.tick} />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function TierCard({ tier }: { tier: Tier }) {
  if (tier.period === "year") return <PlatinumCard tier={tier} />
  return (
    <article
      sx={[
        sectionStyles.bordered,
        styles.tier,
        tier.featured && styles.featured,
      ]}
    >
      <div sx={styles.tierBody}>
        <div sx={styles.tierTop}>
          <span sx={styles.tierKind}>{tier.kind}</span>
          {tier.featured ? (
            <span sx={styles.recommended}>Recommended</span>
          ) : null}
        </div>
        <h4 sx={styles.tierName}>{tier.name}</h4>
        <p sx={styles.tierText}>{tier.text}</p>
        <Price tier={tier} />
        <ul sx={styles.benefits}>
          {tier.benefits.map((benefit) => (
            <li key={benefit} sx={styles.benefit}>
              <Icon icon={Tick02Icon} size="1rem" sx={styles.tick} />
              {benefit}
            </li>
          ))}
        </ul>
        <Button
          variant={tier.featured ? "default" : "outline"}
          nativeButton={false}
          render={
            <a href={tier.audience === "organisation" ? "#companies" : "#give"}>
              {tier.kind === "Custom" ? "Get in touch" : "Choose how to give"}
            </a>
          }
        />
      </div>
    </article>
  )
}

function ChannelRow({ channel }: { channel: Channel }) {
  return (
    <div sx={styles.channel}>
      <div sx={styles.channelText}>
        <span sx={styles.channelName}>{channel.name}</span>
        <span sx={styles.tierText}>{channel.text}</span>
      </div>
      {channel.url ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <a href={channel.url} target="_blank" rel="noreferrer">
              Open
            </a>
          }
        />
      ) : (
        <Badge variant="secondary">At launch</Badge>
      )}
    </div>
  )
}

function Wall() {
  const platinum = SPONSORS.filter((s) => s.tier === "Platinum sponsor")
  const gold = SPONSORS.filter((s) => s.tier === "Gold sponsor")
  // Silver before Bronze.
  const sponsors = [
    ...SPONSORS.filter((s) => s.tier === "Silver sponsor"),
    ...SPONSORS.filter((s) => s.tier === "Bronze sponsor"),
  ]
  const people = SPONSORS.filter(
    (s) => s.tier === "Backer" || s.tier === "Supporter"
  )

  return (
    <>
      <div sx={styles.wallTier}>
        <span sx={sectionStyles.eyebrow}>Platinum sponsors</span>
        <div sx={styles.logosPlatinum}>
          {platinum.map((s) => (
            <a
              key={s.name}
              href={s.url}
              sx={[styles.slot, styles.slotPlatinum, styles.filled]}
            >
              {s.image ? (
                <img src={s.image} alt={s.name} sx={styles.logo} />
              ) : (
                s.name
              )}
            </a>
          ))}
          {platinum.length === 0 ? (
            <a href="#tiers" sx={[styles.slot, styles.slotPlatinum]}>
              Your logo here, in the first place on every page
            </a>
          ) : null}
        </div>
      </div>
      <div sx={styles.wallTier}>
        <span sx={sectionStyles.eyebrow}>Gold sponsors</span>
        <div sx={[styles.logos, styles.logosLarge]}>
          {gold.map((s) => (
            <a
              key={s.name}
              href={s.url}
              sx={[styles.slot, styles.slotLarge, styles.filled]}
            >
              {s.image ? (
                <img src={s.image} alt={s.name} sx={styles.logo} />
              ) : (
                s.name
              )}
            </a>
          ))}
          <a href="#tiers" sx={[styles.slot, styles.slotLarge]}>
            Your logo here
          </a>
        </div>
      </div>
      <div sx={styles.wallTier}>
        <span sx={sectionStyles.eyebrow}>Silver and bronze sponsors</span>
        <div sx={styles.logos}>
          {sponsors.map((s) => (
            <a key={s.name} href={s.url} sx={[styles.slot, styles.filled]}>
              {s.image ? (
                <img src={s.image} alt={s.name} sx={styles.logo} />
              ) : (
                s.name
              )}
            </a>
          ))}
          <a href="#tiers" sx={styles.slot}>
            Your logo here
          </a>
        </div>
      </div>
      <div sx={styles.wallTier}>
        <span sx={sectionStyles.eyebrow}>Backers and supporters</span>
        <div sx={styles.avatars}>
          {people.map((s) => (
            <a key={s.name} href={s.url} title={s.name} sx={styles.avatar}>
              {s.image ? (
                <img src={s.image} alt={s.name} sx={styles.avatar} />
              ) : (
                s.name.slice(0, 2).toUpperCase()
              )}
            </a>
          ))}
          <a href="#tiers" title="Become a backer" sx={styles.avatar}>
            +
          </a>
        </div>
      </div>
    </>
  )
}

const HELP = [
  {
    icon: Bug01Icon,
    title: "Report what broke",
    text: "A bug with a reproduction is worth more than most pull requests.",
    href: "/docs/project/contributing#report-a-bug",
  },
  {
    icon: BookOpen01Icon,
    title: "Fix what confused you",
    text: "If a page made you guess, it is wrong. Say where.",
    href: "/docs/project/contributing#improve-the-docs",
  },
  {
    icon: CodeIcon,
    title: "Write code",
    text: "Start from an issue, keep coverage at 100 %, and sign off your commits.",
    href: "/docs/project/contributing",
  },
  {
    icon: FavouriteIcon,
    title: "Tell someone",
    text: "Write about a migration, or show your team what Kirana found.",
    href: "/showcase",
  },
]

export function SponsorsPage() {
  const individuals = TIERS.filter((t) => t.audience === "individual")
  // The monthly tiers first, from the smallest; the yearly top tier closes the
  // group across the whole row, so a small sponsor does not meet it first.
  const organisations = [
    ...TIERS.filter(
      (t) => t.audience === "organisation" && t.period !== "year"
    ),
    ...TIERS.filter(
      (t) => t.audience === "organisation" && t.period === "year"
    ),
  ]

  return (
    <>
      <PageHero
        label="Sponsor"
        title={
          <>
            Sponsor <Accent>Kirana</Accent>
          </>
        }
        lede="Kirana is built in the open and MIT licensed. Sponsorship pays for the machines that test every change, the work a 1.0 needs, and the time to maintain it, for everyone who uses it."
        actions={
          <>
            <Button
              size="lg"
              nativeButton={false}
              render={<a href="#tiers">See the tiers</a>}
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<a href="#companies">For companies</a>}
            />
          </>
        }
      />

      <PageSection id="tiers">
        <div sx={styles.tierBar}>
          <div sx={styles.tierHead}>
            <h2 sx={styles.tierHeadTitle}>Pick what fits</h2>
            <p sx={styles.tierText}>
              Monthly, yearly or once, as a person or as a company. Every tier
              is a suggestion: give what you can, on the channel that suits you.
            </p>
          </div>
        </div>
        <div sx={styles.group}>
          <h3 sx={styles.groupTitle}>For individuals</h3>
          <div sx={styles.tiers}>
            {individuals.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
        <div sx={styles.group}>
          <h3 sx={styles.groupTitle}>For organisations</h3>
          <div sx={[styles.tiers, styles.tiersFour]}>
            {organisations.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </PageSection>

      <PageSection
        id="terms"
        number="01"
        label="Terms"
        title="What a sponsorship covers, and what it does not"
        lede="Read this before you pay. Sponsorship keeps Kirana maintained and independent; it does not buy control of it."
      >
        <FaqGroups
          groups={[
            {
              topic: "It covers",
              tone: "neutral",
              icon: Tick02Icon,
              items: TERMS.covers.map((term) => ({
                title: term.title,
                body: <p>{term.text}</p>,
              })),
            },
            {
              topic: "It does not cover",
              tone: "neutral",
              icon: Cancel01Icon,
              items: TERMS.excludes.map((term) => ({
                title: term.title,
                body: <p>{term.text}</p>,
              })),
            },
          ]}
        />
      </PageSection>

      <PageSection
        id="give"
        number="02"
        label="Channels"
        title="Choose your channel"
        lede="Several doors, so nobody is turned away by how they pay. Channels open as their accounts are approved; until then they say so."
      >
        <div sx={styles.channelGroups}>
          {CHANNELS.map((group) => (
            <div
              key={group.title}
              id={group.title === "For companies" ? "companies" : undefined}
              sx={[sectionStyles.bordered, styles.channelGroup]}
            >
              <div sx={styles.channelHead}>
                <span sx={styles.groupTitle}>{group.title}</span>
                <span sx={styles.tierText}>{group.text}</span>
              </div>
              <div sx={styles.channelList}>
                {group.channels.map((channel) => (
                  <ChannelRow key={channel.name} channel={channel} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="03"
        label="Funding"
        title="What funding unlocks"
        lede="In the order it would be spent. Running costs come first; maintainer time is the largest cost and the one that sets the pace."
      >
        <ol sx={styles.goals}>
          {GOALS.map((goal, index) => (
            <li key={goal.title} sx={[sectionStyles.bordered, styles.goal]}>
              <span sx={styles.step}>{index + 1}</span>
              <span sx={styles.groupTitle}>{goal.title}</span>
              <span sx={styles.tierText}>{goal.text}</span>
              <ul sx={styles.goalList}>
                {goal.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection
        number="04"
        label="Community"
        title="Kirana is all of us"
        lede={
          SPONSORS.length === 0
            ? "No sponsors yet. The first names on this page will stay at the top of it."
            : "Thank you. Every name here keeps Kirana independent."
        }
      >
        <Wall />
      </PageSection>

      <PageSection number="05" label="Other help" title="Other ways to help">
        <div sx={styles.helps}>
          {HELP.map((item) => (
            <DocsLink
              key={item.title}
              href={item.href}
              sx={[sectionStyles.bordered, styles.help]}
            >
              <span sx={styles.iconBadge}>
                <Icon icon={item.icon} size="1.25rem" />
              </span>
              <span sx={styles.helpTitle}>{item.title}</span>
              <span sx={styles.tierText}>{item.text}</span>
              <More>Read more</More>
            </DocsLink>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="06"
        label="Before you start"
        title="Before you sponsor"
      >
        <FaqGroups
          groups={FAQ.map((group) => ({
            topic: group.topic,
            items: group.items.map((item) => ({
              title: item.question,
              body: <p>{item.answer}</p>,
            })),
          }))}
        />
      </PageSection>
    </>
  )
}
