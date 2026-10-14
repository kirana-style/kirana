import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { SVGL } from "@/generated/svgl-icons.gen"

import { tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { CodeBlock } from "@workspace/docs-ui/markdown/code-block.tsx"
import { Button } from "@workspace/ui/components/button"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { NextStep } from "@/components/site/accents"
import { Figures, Steps } from "@/components/site/cards"
import { CodeTokens } from "@/components/site/code-tokens"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { SHOWCASE } from "@/generated/showcase.gen"
import { ShowcaseScene } from "@/components/home/showcase"

export const Route = createFileRoute("/migrate")({
  component: MigratePage,
  head: () => ({
    meta: [
      { title: "Migrate to Kirana" },
      {
        name: "description",
        content:
          "kirana migrate tailwind and kirana migrate stylex rewrite your styles, print a diff and a report of what they would not decide, and write nothing until you say so.",
      },
    ],
  }),
})

/** From the mapping table in `/docs/migration/from-tailwind`. */
const MAPPING: readonly { from: string; to: string; prose?: boolean }[] = [
  {
    from: "px-4 py-2",
    to: "{ paddingInline: space[4], paddingBlock: space[2] }",
  },
  {
    from: "hover:underline",
    to: '{ textDecorationLine: { ":hover": "underline" } }',
  },
  {
    from: "md:grid-cols-2",
    to: '{ gridTemplateColumns: { [breakpoint.md]: "repeat(2, minmax(0, 1fr))" } }',
  },
  {
    from: "dark:bg-zinc-900",
    to: "Nothing to write — the colour token is already a light-dark() pair.",
    prose: true,
  },
  {
    from: "group-hover:opacity-100",
    to: '{ opacity: { [group.within(":hover")]: 1 } }',
  },
  { from: "cn(a, b)", to: "cx(a, b)  or  sx={[a, b]}" },
]

/** "The process that worked", shortened. */
const PROCESS = [
  {
    title: "Port leaf components first",
    text: "They have the fewest conditions and teach you the shape.",
  },
  {
    title: "Keep the structure",
    text: "Same elements, same attributes; change only how styles are written. Then a diff means something.",
  },
  {
    title: "Run kirana check after each one",
    text: "sx-on-external-component and unused-sx catch the two mistakes everyone makes with wrapper components.",
  },
  {
    title: "Compare computed styles, not screenshots",
    text: "Diff every element in both schemes at three widths — and again with overlays open and rows highlighted.",
  },
  {
    title: "Keep hand fixes as patches",
    text: "Apply them over a fresh run of the codemod, so it can improve and be re-run without losing work.",
  },
  {
    title: "Give your agent the migrate skill",
    text: "npx skills add installs kirana-migrate: the codemods, the traps in both directions and how to check the result, for the agent doing the porting.",
  },
]

const styles = {
  codemods: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  codemod: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    minWidth: 0,
    gap: spacing[4],
    alignContent: "start",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: spacing[6],
  }),
  codemodHead: css({ display: "flex", alignItems: "center", gap: spacing[3] }),
  codemodTitle: css({
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.semibold,
  }),
  text: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  mapping: css({
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  row: css({
    display: "grid",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "16rem minmax(0, 1fr)",
    },
    gap: { base: spacing[1], [breakpoint.md]: spacing[4] },
    paddingInline: spacing[5],
    paddingBlock: spacing[3],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
  prose: css({
    fontFamily: fontFamily.sans,
    color: theme.mutedForeground,
  }),
  head: css({
    backgroundColor: tint(8),
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  note: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

function MigratePage() {
  return (
    <Page scene="heritage-street">
      <PageHero
        label="Migrate"
        title={
          <>
            Bring the styles <Accent>you already have.</Accent>
          </>
        }
        lede="Two codemods rewrite Tailwind and StyleX sources. Each prints a diff and a report of what it would not decide, and writes nothing until you say so."
        actions={
          <>
            <Button
              size="lg"
              nativeButton={false}
              render={
                <DocsLink href="/docs/migration/from-tailwind">
                  From Tailwind
                </DocsLink>
              }
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={
                <DocsLink href="/docs/migration/from-stylex">
                  From StyleX
                </DocsLink>
              }
            />
          </>
        }
      />

      <PageSection
        number="01"
        label="Example"
        title="One card, before and after"
        lede="The right-hand file is what kirana migrate tailwind wrote for the left-hand one — one long line re-wrapped, nothing else changed. The dark variant became a light-dark() pair."
      >
        <ShowcaseScene id="migrate" />
      </PageSection>

      <PageSection
        number="02"
        label="Evidence"
        title="Measured on a whole codebase"
        lede="The codemod was run over the Tailwind original of our shadcn/ui port — packages/ui, the shared shell, and three applications — and the result compared with the original, element by element."
      >
        <Figures
          items={[
            { value: "199", label: "report items from the codemod, unedited" },
            {
              value: "38",
              label: "hand patches, each resolving report items",
            },
            {
              value: "0",
              label: "computed-style differences at rest, on 189 routes",
            },
            {
              value: "0",
              label: "differences with dialogs, menus and selects open",
            },
          ]}
        />
        <p sx={styles.note}>
          What conformance does not prove: right-to-left layouts, states outside
          the harness's list, and elements without a data-slot.{" "}
          <DocsLink href="/docs/migration/from-tailwind#measured-this-repositorys-tailwind-original">
            <More>The full account</More>
          </DocsLink>
        </p>
      </PageSection>

      <PageSection number="03" label="The tools" title="Two codemods">
        <div sx={styles.codemods}>
          <div sx={styles.codemod}>
            <div sx={styles.codemodHead}>
              <BrandIcon icon={SVGL.tailwindcss} size="1.5rem" />
              <span sx={styles.codemodTitle}>From Tailwind</span>
            </div>
            <p sx={styles.text}>
              Class strings become css() objects, cn() becomes sx arrays, cva
              becomes recipe, group and peer become relations. It uses the same
              utility grammar as utility strings, so the object compiles to the
              atoms of the class string it replaces.
            </p>
            <CodeBlock
              html={SHOWCASE["migrate-tailwind-command"]!.html}
              source={SHOWCASE["migrate-tailwind-command"]!.source}
              variant="terminal"
              lang="bash"
            />
            <DocsLink href="/docs/migration/from-tailwind">
              <More>Migrating from Tailwind</More>
            </DocsLink>
          </div>
          <div sx={styles.codemod}>
            <div sx={styles.codemodHead}>
              <BrandIcon icon={SVGL.stylex} size="1.5rem" />
              <span sx={styles.codemodTitle}>From StyleX</span>
            </div>
            <p sx={styles.text}>
              create becomes css, defineVars becomes defineTokens, createTheme
              becomes defineTheme, markers become relations. Then kirana check
              finds the relations without anchors and the components that
              swallow sx.
            </p>
            <CodeBlock
              html={SHOWCASE["migrate-stylex-command"]!.html}
              source={SHOWCASE["migrate-stylex-command"]!.source}
              variant="terminal"
              lang="bash"
            />
            <DocsLink href="/docs/migration/from-stylex">
              <More>Migrating from StyleX</More>
            </DocsLink>
          </div>
        </div>
      </PageSection>

      <PageSection
        number="04"
        label="Mapping"
        title="What maps to what"
        lede="A few rows of the Tailwind mapping; the guide has the rest."
      >
        <div sx={styles.mapping} role="table">
          <div sx={[styles.row, styles.head]} role="row">
            <span role="columnheader">Tailwind</span>
            <span role="columnheader">Kirana</span>
          </div>
          {MAPPING.map((row) => (
            <div key={row.from} sx={styles.row} role="row">
              <span role="cell">
                <CodeTokens lang="classes">{row.from}</CodeTokens>
              </span>
              <span role="cell">
                {row.prose ? (
                  <span sx={styles.prose}>{row.to}</span>
                ) : (
                  <CodeTokens>{row.to}</CodeTokens>
                )}
              </span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="05"
        label="Process"
        title="The process that worked"
        lede="How the shadcn/ui port reached zero differences."
      >
        <Steps items={PROCESS} />
      </PageSection>

      <PageSection flush>
        <NextStep
          title="Check a migration the way we did"
          actions={
            <Button
              size="lg"
              nativeButton={false}
              render={
                <DocsLink href="/docs/advanced/conformance">
                  Verifying a migration
                </DocsLink>
              }
            />
          }
        >
          Diff the computed style of every element against the original, in both
          schemes and at three widths.
        </NextStep>
      </PageSection>
    </Page>
  )
}
