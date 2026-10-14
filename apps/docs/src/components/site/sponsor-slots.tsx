/**
 * Where sponsors show up outside their own page: beside every docs page
 * (under the table of contents), at the foot of the docs sidebar, and on the
 * homepage. Until a Gold sponsor exists, each slot is an empty frame that says
 * what would go there and links to the terms — an invitation, never a fake logo.
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon, FavouriteIcon } from "@hugeicons/core-free-icons"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { SPONSORS } from "@/components/sponsors/data"
import { LIFT, REST } from "@/components/site/lift"

const styles = {
  rail: css({ display: "grid", gap: spacing[3] }),
  label: css({
    fontSize: "0.6875rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  // An empty frame the size of a logo, dashed so it reads as a vacancy.
  slot: css({
    display: "grid",
    placeItems: "center",
    aspectRatio: "3 / 1",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: "transparent",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: { base: theme.mutedForeground, ":hover": accent.base },
    textDecorationLine: "none",
    transitionProperty: "box-shadow, border-color, background-color, color",
    transitionDuration: duration[150],
  }),
  logo: css({
    display: "grid",
    placeItems: "center",
    aspectRatio: "3 / 1",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingInline: spacing[3],
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
    textDecorationLine: "none",
  }),
  logoImage: css({ maxWidth: "100%", maxHeight: "2.5rem" }),
  note: css({
    fontSize: fontSize.xs,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
  link: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: { base: theme.foreground, ":hover": accent.base },
    textDecorationLine: "none",
  }),

  // The sidebar's foot: one quiet row.
  foot: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["2.5"],
    padding: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: { base: "transparent", ":hover": alpha.muted50 },
    textDecorationLine: "none",
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  footIcon: css({
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.md,
    backgroundColor: tint(14),
    color: accent.base,
  }),
  footText: css({ display: "grid", minWidth: 0 }),
  footTitle: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
}

/** The sponsors shown beside the docs: Platinum first, then Gold. */
const gold = () => [
  ...SPONSORS.filter((sponsor) => sponsor.tier === "Platinum sponsor"),
  ...SPONSORS.filter((sponsor) => sponsor.tier === "Gold sponsor"),
]

/** A sponsor's logo, or its name when there is no image. */
export function SponsorLogo({
  sponsor,
}: {
  sponsor: (typeof SPONSORS)[number]
}) {
  return (
    <a
      href={sponsor.url}
      rel="sponsored noopener"
      target="_blank"
      title={sponsor.name}
      sx={styles.logo}
    >
      {sponsor.image ? (
        <img src={sponsor.image} alt={sponsor.name} sx={styles.logoImage} />
      ) : (
        sponsor.name
      )}
    </a>
  )
}

/** An empty slot, linking to the tiers. */
export function SponsorVacancy({
  label = "Your logo here",
}: {
  label?: string
}) {
  return (
    <DocsLink href="/sponsors#tiers" sx={styles.slot}>
      {label}
    </DocsLink>
  )
}

/** Under the table of contents on every docs page. */
export function RailSponsor() {
  const sponsors = gold()
  return (
    <aside sx={[accents.ochre, styles.rail]} aria-label="Sponsors">
      <span sx={styles.label}>Sponsors</span>
      {sponsors.length > 0 ? (
        sponsors.map((sponsor) => (
          <SponsorLogo key={sponsor.name} sponsor={sponsor} />
        ))
      ) : (
        <>
          <SponsorVacancy />
          <p sx={styles.note}>
            Platinum and Gold sponsors are shown here, beside every docs page.
            Kirana is MIT licensed; sponsorship pays for its maintenance.
          </p>
        </>
      )}
      <DocsLink href="/sponsors#terms" sx={styles.link}>
        What sponsorship covers
        <Icon icon={ArrowRight01Icon} size="0.75rem" />
      </DocsLink>
    </aside>
  )
}

/** Pinned at the foot of the docs sidebar. */
export function SidebarSponsor() {
  return (
    <DocsLink href="/sponsors" sx={[accents.ochre, styles.foot]}>
      <span sx={styles.footIcon}>
        <Icon icon={FavouriteIcon} size="1rem" />
      </span>
      <span sx={styles.footText}>
        <span sx={styles.footTitle}>Sponsor Kirana</span>
        <span sx={styles.note}>MIT licensed; sponsors fund its upkeep.</span>
      </span>
    </DocsLink>
  )
}
