/**
 * `/ui`: Kirana UI, for someone weighing a move to Kirana whose first question is what happens to
 * their components. Its own site (`UI_SITE`) shows the components; this page says what they are,
 * how they install and where each framework stands (`UI_FRAMEWORKS`).
 */
import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"

import { CodeBlock } from "@workspace/docs-ui/markdown/code-block.tsx"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { NextStep } from "@/components/site/accents"
import { QuickStart, SecondaryCta } from "@/components/site/cta"
import { DocsLink } from "@/components/docs-link"
import { IllustratedCard, PillLinks } from "@/components/site/illustrated-card"
import { ChartArt, DesignArt, UiFrameworks } from "@/components/site/kirana-ui"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { UI_STATUS } from "@/data/kirana-ui"
import { UI_PAGES } from "@/data/links"
import { SHOWCASE } from "@/generated/showcase.gen"

export const Route = createFileRoute("/ui")({
  component: UiPage,
  head: () => ({
    meta: [
      { title: "Kirana UI · Kirana" },
      {
        name: "description",
        content:
          "shadcn/ui's components, blocks and charts, rebuilt on typed styles and compiled by Kirana. Installed into your project with kirana-style ui add, as code you own.",
      },
    ],
  }),
})

const styles = {
  cells: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderBlockWidth: "1px",
    borderBlockStyle: "solid",
    borderBlockColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  cell: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    paddingBlock: { base: spacing[6], [breakpoint.md]: spacing[8] },
    paddingInline: { base: 0, [breakpoint.md]: spacing[6] },
    backgroundColor: theme.background,
  }),
  kicker: css({
    fontFamily: fontFamily.mono,
    fontSize: textSize.micro,
    lineHeight: textLeading.micro,
    letterSpacing: textTracking.micro,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  heading: css({
    margin: 0,
    fontSize: fontSize.lg,
    lineHeight: "1.4",
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  text: css({
    margin: 0,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  install: css({
    display: "grid",
    gap: { base: spacing[8], [breakpoint.lg]: spacing[12] },
    alignItems: "start",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 3fr) minmax(0, 2fr)",
    },
  }),
  steps: css({
    display: "grid",
    gap: spacing[4],
    margin: 0,
    paddingInlineStart: spacing[5],
    fontSize: fontSize.base,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  cards: css({
    display: "grid",
    gap: spacing[6],
    gridTemplateColumns: { base: "minmax(0, 1fr)" },
  }),
}

/** What a project gets, and owns, with each component. */
const OWNED = [
  {
    kicker: "The same components",
    title: "shadcn/ui's API and look",
    text: "The components and charts shadcn/ui has, with the same names and parts, on Base UI or React Aria underneath.",
  },
  {
    kicker: "Code you own",
    title: "Copied in, not imported",
    text: "kirana-style ui add writes each component into your project and records it in a lockfile. ui diff and ui update show and take the registry's changes, keeping yours.",
  },
  {
    kicker: "Typed styles",
    title: "A style module you can read",
    text: "Each component's styles are a TypeScript module of css() handles, compiled into your one stylesheet. There is no Tailwind, no cn and no class-variance-authority to carry.",
  },
] as const

function UiPage() {
  const commands = SHOWCASE["kirana-ui"]!
  return (
    <Page scene="misty-hills">
      <PageHero
        label="Kirana UI"
        title={
          <>
            Components you don&apos;t have to <Accent>port</Accent>
          </>
        }
        lede="The question before any move to a new way of styling is what happens to the components. Kirana UI is shadcn/ui's set, its blocks and its charts, already rebuilt on typed styles and compiled by Kirana, installed into your project with one command."
        actions={
          <>
            <QuickStart href={UI_PAGES.components}>
              Browse the components
            </QuickStart>
            <SecondaryCta render={<DocsLink href="/docs/tooling/components" />}>
              Install a component
            </SecondaryCta>
          </>
        }
      />

      <PageSection
        number="01"
        label="What you get"
        title="The components you know, as code you own"
        lede="Moving to Kirana does not start with porting a component library: the one most React projects build on is already here."
      >
        <div sx={styles.cells}>
          {OWNED.map((entry) => (
            <div key={entry.kicker} sx={styles.cell}>
              <span sx={styles.kicker}>{entry.kicker}</span>
              <h3 sx={styles.heading}>{entry.title}</h3>
              <p sx={styles.text}>{entry.text}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="Install"
        title="Set up once, then add what you need"
        lede="ui init sets the project up for the registry: Kirana where it is missing, the design system and the design a preset code names. ui add installs a component with every item it needs."
      >
        <div sx={styles.install}>
          <CodeBlock
            html={commands.html}
            source={commands.source}
            variant="terminal"
            lang="bash"
          />
          <ol sx={styles.steps}>
            <li>
              Each file lands under your own aliases, its imports rewritten to
              them.
            </li>
            <li>
              Each icon becomes your icon library&apos;s, imported by name; no
              other library comes with it.
            </li>
            <li>
              What was written is checked by the compiler before the command
              ends.
            </li>
          </ol>
        </div>
      </PageSection>

      <PageSection
        number="03"
        label="Your design"
        title="One design, chosen once"
        lede="A style, a base colour, a theme, fonts, a radius and an icon library, picked on the site and carried as a preset code."
      >
        <div sx={styles.cards}>
          <IllustratedCard
            wide
            art={<DesignArt />}
            title="A preset, in your configuration"
            text="ui preset writes the design to ui.design and sets its attributes on <html>, then places every installed component again. Each one installs with only the chosen style's values."
          >
            <PillLinks
              links={[
                { title: "Make a preset", href: UI_PAGES.create },
                {
                  title: "Presets in the docs",
                  href: "/docs/tooling/components",
                },
              ]}
            />
          </IllustratedCard>
        </div>
      </PageSection>

      <PageSection
        number="04"
        label="Frameworks"
        title="React today, the others on the way"
        lede={`One style module serves every framework: only the markup is per framework. ${UI_STATUS}, each on the libraries it uses.`}
      >
        <UiFrameworks />
      </PageSection>

      <PageSection
        number="05"
        label="Beyond components"
        title="Charts and blocks, from the same styles"
        lede="Charts drawn with the same tokens as the components around them, and whole sections to start a page from."
      >
        <div sx={styles.cards}>
          <IllustratedCard
            wide
            art={<ChartArt />}
            title="Charts, and blocks to start from"
            text="shadcn/ui's chart types, each installed the way a component is. The blocks (dashboards, sign-in pages, sidebars) are on the site to start a page from."
          >
            <PillLinks
              links={[
                { title: "Charts", href: UI_PAGES.charts },
                { title: "Blocks", href: UI_PAGES.blocks },
              ]}
            />
          </IllustratedCard>
        </div>
      </PageSection>

      <PageSection flush>
        <NextStep
          title="Add your first component"
          actions={
            <QuickStart href="/docs/tooling/components">
              Install a component
            </QuickStart>
          }
        >
          Set the project up with a preset from the site, then add what you
          need: each component arrives with what it needs and nothing else.
        </NextStep>
      </PageSection>
    </Page>
  )
}
