import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  FavouriteIcon,
  GitBranchIcon,
  JusticeScale01Icon,
  SourceCodeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { theme } from "@workspace/ui/theme/semantic"
import { fontSize } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { NextStep } from "@/components/site/accents"
import { Card, CardGrid, Steps } from "@/components/site/cards"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { GOALS } from "@/components/sponsors/data"

export const Route = createFileRoute("/open-source")({
  component: OpenSourcePage,
  head: () => ({
    meta: [
      { title: "Open source · Kirana" },
      {
        name: "description",
        content:
          "Why Kirana is MIT licensed, where sponsorship goes, and how to take part.",
      },
    ],
  }),
})

/** The principles the project is funded by. */
const PRINCIPLES = [
  {
    icon: JusticeScale01Icon,
    title: "The code stays free",
    text: "Everything in the repository is MIT licensed. Sponsorship pays for maintenance; tiers buy visibility and attention, never features.",
  },
  {
    icon: UserGroupIcon,
    title: "Funds go to the organisation",
    text: "Channels are registered to the kirana-style GitHub organisation wherever the platform allows it, not to a person.",
  },
  {
    icon: FavouriteIcon,
    title: "Many doors",
    text: "Individuals and companies each have a channel that suits how they pay.",
  },
  {
    icon: SourceCodeIcon,
    title: "Nothing claims more than is true",
    text: "A channel without an account says “at launch”; fees are stated only where the platform documents them.",
  },
]

const styles = {
  prose: css({ lineHeight: "1.7", color: theme.mutedForeground }),
  link: css({
    color: theme.foreground,
    textDecorationLine: "underline",
    textUnderlineOffset: "3px",
  }),
  note: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
}

function OpenSourcePage() {
  return (
    <Page scene="old-hall">
      <PageHero
        label="Open source"
        title={
          <>
            Built in the open, <Accent>kept free.</Accent>
          </>
        }
        lede="A styling compiler sits under everything you ship. It should be something you can read, fork and keep running whatever happens to the people who started it. So Kirana is MIT licensed, and paid for by the people who use it."
        actions={
          <>
            <Button
              size="lg"
              nativeButton={false}
              render={<DocsLink href="/sponsors">Sponsor Kirana</DocsLink>}
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={
                <DocsLink href="/docs/project/contributing">
                  Contribute
                </DocsLink>
              }
            />
          </>
        }
      />

      <PageSection number="01" label="Principles" title="Four principles">
        <CardGrid cols={4}>
          {PRINCIPLES.map((principle) => (
            <Card
              key={principle.title}
              icon={principle.icon}
              title={principle.title}
            >
              {principle.text}
            </Card>
          ))}
        </CardGrid>
      </PageSection>

      <PageSection
        number="02"
        label="Funding"
        title="Where the money goes"
        lede="In this order: running costs first, then what a 1.0 needs, then maintainer time."
      >
        <Steps
          items={GOALS.map((goal) => ({
            title: goal.title,
            text: `${goal.text} ${goal.items.join("; ")}.`,
          }))}
        />
      </PageSection>

      <PageSection
        number="03"
        label="Contributing"
        title="Taking part"
        lede="Money is one way. Reports, documentation and code count as much."
      >
        <CardGrid>
          <Card
            icon={GitBranchIcon}
            title="Contribute"
            href="/docs/project/contributing"
          >
            Report a bug, improve a page, or write code.
          </Card>
          <Card icon={FavouriteIcon} title="Sponsor" href="/sponsors">
            Monthly or once, as a person or a company, through the channel that
            suits you.
          </Card>
          <Card icon={JusticeScale01Icon} title="The licence" href="/license">
            MIT, with the notices for what Kirana builds on.
          </Card>
        </CardGrid>
        <p sx={styles.note}>
          The repository is public on GitHub. A sponsorship channel that has no
          account yet says “at launch” until it opens.
        </p>
      </PageSection>

      <PageSection
        number="04"
        label="The name"
        title="One name we would like to ask about"
        lede="Kirana's packages would read best as @kirana/core and @kirana/vite."
      >
        <p sx={styles.prose}>
          The @kirana organisation on npm already belongs to someone, and that
          is fair: names are first come, first served. If it is yours, you are
          not using it, and you would consider passing it on, we would be glad
          to hear from you at{" "}
          <a href="mailto:hello@kirana.style" sx={styles.link}>
            hello@kirana.style
          </a>
          . There is no expectation and no deadline, and Kirana ships as
          @kirana-style in the meantime.
        </p>
      </PageSection>

      <PageSection flush>
        <NextStep
          title="Keep Kirana independent"
          actions={
            <Button
              size="lg"
              nativeButton={false}
              render={<DocsLink href="/sponsors">See the tiers</DocsLink>}
            />
          }
        >
          Sponsorship pays for CI, a security review, dedicated benchmark
          hardware and maintainer time.
        </NextStep>
      </PageSection>
    </Page>
  )
}
