import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { InformationCircleIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { radius, surface, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { engine, examples } from "@/lib/compile"

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>) => ({
    example: typeof search.example === "string" ? search.example : undefined,
  }),
  component: Play,
  head: () => ({ meta: [{ title: "Playground · Kirana" }] }),
})

const styles = {
  picker: css({
    overflowX: "auto",
    scrollbarWidth: "none",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    fontFamily: fontFamily.mono,
  }),
  panes: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  pane: css({
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    overflow: "hidden",
  }),
  paneTitle: css({
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    backgroundColor: surface.page,
    paddingInline: spacing[4],
    paddingBlock: spacing[2],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  }),
  scroll: css({ overflowX: "auto", maxHeight: "32rem", overflowY: "auto" }),
  code: css({
    margin: 0,
    padding: spacing[4],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  meta: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
}

function Play() {
  const { example: selected } = Route.useSearch()
  const navigate = Route.useNavigate()
  const current = examples.find((item) => item.name === selected) ?? examples[0]

  return (
    <Page accent="emerald">
      <PageHero
        icon={PlayIcon}
        pattern="clouds"
        eyebrow="Playground"
        title="See what the compiler made"
        lede="Pick an example: its source, the CSS the compiler emitted for it, and the classes it defines."
      />
      <PageSection>
        <Alert>
          <AlertIcon icon={InformationCircleIcon} />
          <AlertTitle>These examples are compiled, not simulated</AlertTitle>
          <AlertDescription>
            Each pane below was produced by the compiler in this repository when
            the site was built. Editing source in the browser needs the compiler
            running in the page, which is not built yet — until then the source
            is read-only rather than an editor that quietly compiles nothing.{" "}
            <DocsLink href="/docs/project/roadmap">See the roadmap</DocsLink>.
          </AlertDescription>
        </Alert>

        <Tabs
          value={current?.name}
          onValueChange={(name) =>
            void navigate({ search: { example: String(name) }, replace: true })
          }
        >
          <div sx={styles.picker}>
            <TabsList variant="line">
              {examples.map((item) => (
                <TabsTrigger key={item.name} value={item.name}>
                  {item.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {current ? (
          <>
            <div sx={styles.panes}>
              <section sx={styles.pane}>
                <p sx={styles.paneTitle}>Source · {current.name}.tsx</p>
                <div sx={styles.scroll}>
                  <pre sx={styles.code} data-slot="code-block-source">
                    <code
                      dangerouslySetInnerHTML={{ __html: current.sourceHtml }}
                    />
                  </pre>
                </div>
              </section>
              <section sx={styles.pane}>
                <p sx={styles.paneTitle}>Compiled CSS</p>
                <div sx={styles.scroll}>
                  <pre sx={styles.code} data-slot="code-block-source">
                    <code
                      dangerouslySetInnerHTML={{ __html: current.cssHtml }}
                    />
                  </pre>
                </div>
              </section>
            </div>
            <p sx={styles.meta}>
              <span>{current.classNames.length} classes</span>
              <span>{current.diagnostics.length} diagnostics</span>
              <span>engine: {engine.id}</span>
            </p>
          </>
        ) : null}
      </PageSection>
    </Page>
  )
}
