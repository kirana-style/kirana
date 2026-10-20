/**
 * The partners page: the companies that give Kirana a service it runs on, listed by what each
 * provides. Sponsors pay for the work and have tiers (`/sponsors`); a partner gives a service in
 * kind, and a service is not an amount, so there are no tiers here. Each area shows its partner,
 * or that it is open.
 */
import { css } from "@kirana-style/core"

import { IconTile } from "@/components/site/icon-tile"
import { Button } from "@workspace/ui/components/button"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { sectionStyles } from "@/components/page-section"
import { Accent, PageHero, PageSection } from "@/components/site/page"
import { AREAS, PARTNERS, PARTNER_EMAIL } from "@/data/partners"
import type { Area } from "@/data/partners"

const styles = {
  // Related cells split by 1px gutters over the border colour.
  cells: css({
    display: "grid",
    gap: "1px",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
    },
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
  }),
  cell: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    backgroundColor: theme.card,
    padding: spacing[6],
  }),
  cellTitle: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
  }),
  text: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  partner: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
  }),
  logo: css({ height: spacing[6], width: "auto" }),
  open: css({
    justifySelf: "start",
    borderRadius: radius.full,
    backgroundColor: alpha.muted50,
    paddingInline: spacing["2.5"],
    paddingBlock: spacing["0.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
  }),
  steps: css({
    display: "grid",
    gap: spacing[4],
    maxWidth: "48rem",
    paddingInlineStart: spacing[5],
    fontSize: fontSize.base,
    lineHeight: "1.7",
    color: theme.mutedForeground,
  }),
  strong: css({ color: theme.foreground, fontWeight: fontWeight.medium }),
}

function AreaCell({ area }: { area: Area }) {
  const partners = PARTNERS.filter((partner) => partner.area === area.id)
  return (
    <div sx={styles.cell}>
      <IconTile icon={area.icon} />
      <span sx={styles.cellTitle}>{area.title}</span>
      <p sx={styles.text}>{area.use}</p>
      {partners.length === 0 ? (
        <span sx={styles.open}>Open</span>
      ) : (
        partners.map((partner) => (
          <a key={partner.name} href={partner.url} sx={styles.partner}>
            {partner.logo ? (
              <img src={partner.logo} alt={partner.name} sx={styles.logo} />
            ) : (
              partner.name
            )}
            <span sx={styles.text}>{partner.provides}</span>
          </a>
        ))
      )}
    </div>
  )
}

export function PartnersPage() {
  return (
    <>
      <PageHero
        label="Partners"
        title={
          <>
            The services Kirana <Accent>runs on</Accent>
          </>
        }
        lede="Partners give Kirana a service it runs on, in kind: hosting, machines for tests and benchmarks, email, AI. Each is listed for what it provides; there are no tiers, because a service is not an amount."
        actions={
          <>
            <Button
              size="lg"
              nativeButton={false}
              render={
                <a
                  href={`mailto:${PARTNER_EMAIL}?subject=Partnering%20with%20Kirana`}
                />
              }
            >
              Offer a service
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<DocsLink href="/sponsors" />}
            >
              Sponsor instead
            </Button>
          </>
        }
      />

      <PageSection
        number="01"
        label="What partners provide"
        title="Four things Kirana runs on"
        lede={
          PARTNERS.length === 0
            ? "No partners yet. Each area shows its partner once the service is in use."
            : "Thank you. Each area shows who provides it."
        }
      >
        <div sx={styles.cells}>
          {AREAS.map((area) => (
            <AreaCell key={area.id} area={area} />
          ))}
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="Partner or sponsor"
        title="A service, or funding"
        lede="Both keep Kirana independent. They are listed apart because they give different things."
      >
        <div sx={styles.cells}>
          <div sx={styles.cell}>
            <span sx={styles.cellTitle}>A partner</span>
            <p sx={styles.text}>
              Gives a service Kirana uses, free or at a discount: a host, a
              runner, a mail provider, model credits. Listed here by what it
              provides, with no tiers.
            </p>
          </div>
          <div sx={styles.cell}>
            <span sx={styles.cellTitle}>A sponsor</span>
            <p sx={styles.text}>
              Funds the work, monthly or once, through GitHub Sponsors, Open
              Collective or an invoice. Listed on the{" "}
              <DocsLink href="/sponsors">sponsor page</DocsLink> by tier.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection number="03" label="How it works" title="Becoming a partner">
        <ol sx={styles.steps}>
          <li>
            <span sx={styles.strong}>Write to {PARTNER_EMAIL}</span> with the
            service you would provide and on what terms.
          </li>
          <li>
            <span sx={styles.strong}>Kirana uses it where it fits</span>, on its
            merits: the service has to be one the project would choose anyway.
          </li>
          <li>
            <span sx={styles.strong}>Your name is listed here</span>, under what
            you provide, for as long as the service is in use.
          </li>
          <li>
            <span sx={styles.strong}>A partnership buys no say</span> in the
            roadmap or the license, and no exclusivity: Kirana stays free to use
            another provider beside yours.
          </li>
        </ol>
        <p sx={sectionStyles.sub}>
          Kirana is MIT licensed, and stays so whoever provides what.
        </p>
      </PageSection>
    </>
  )
}
