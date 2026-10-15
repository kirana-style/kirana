/**
 * The playground: an example's source and the CSS the compiler wrote for it, as two editor
 * windows on one of Kirana's landscapes — the same windows, colours and frosted glass as the
 * homepage's editor scene. Both panes are build output (`generate-examples.ts`), read-only until
 * the compiler runs in the page.
 */
import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { Backdrop } from "@/components/site/backdrop"
import {
  EditorLines,
  EditorWindow,
  VSCODE,
} from "@/components/site/editor-window"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { engine, examples } from "@/lib/compile"

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>) => ({
    example: typeof search.example === "string" ? search.example : undefined,
  }),
  component: Play,
  head: () => ({ meta: [{ title: "Playground · Kirana" }] }),
})

const UI_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, Ubuntu, sans-serif'

const styles = {
  picker: css({
    overflowX: "auto",
    scrollbarWidth: "none",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    fontFamily: fontFamily.mono,
  }),
  stage: css({
    paddingBlockEnd: { base: spacing[4], [breakpoint.md]: "6%" },
  }),
  windows: css({
    display: "grid",
    gap: { base: spacing[2], [breakpoint.md]: spacing[3] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  scroll: css({
    maxHeight: "30rem",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "rgb(110 118 129 / 0.4) transparent",
  }),
  // VS Code's Problems panel: one row per diagnostic, under the source.
  problems: css({
    display: "grid",
    gap: "2px",
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: VSCODE.border,
    fontFamily: UI_FONT,
    fontSize: "12px",
    color: VSCODE.foreground,
  }),
  problem: css({ display: "flex", gap: spacing[2], alignItems: "baseline" }),
  problemIcon: css({ flexShrink: 0, color: "#d29922", translate: "0 2px" }),
  problemWhere: css({ color: VSCODE.codeLens }),
  // VS Code's status bar: the counts, at the window's foot.
  status: css({
    display: "flex",
    flexWrap: "wrap",
    columnGap: spacing[4],
    paddingInline: spacing[3],
    paddingBlock: "3px",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: VSCODE.border,
    backgroundColor: VSCODE.sidebar,
    fontFamily: UI_FONT,
    fontSize: "12px",
    color: VSCODE.codeLens,
  }),
  statusItem: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  }),
}

function Play() {
  const { example: selected } = Route.useSearch()
  const navigate = Route.useNavigate()
  const current = examples.find((item) => item.name === selected) ?? examples[0]

  return (
    <Page scene="turquoise-lake">
      <PageHero
        label="Playground"
        title="See what the compiler made"
        lede="Pick an example: its source, the CSS the compiler emitted for it, and the classes it defines."
      />
      <PageSection>
        <Alert>
          <AlertIcon icon={InformationCircleIcon} />
          <AlertTitle>These examples are compiled, not simulated</AlertTitle>
          <AlertDescription>
            Each window below was produced by the compiler in this repository
            when the site was built. Editing source in the browser needs the
            compiler running in the page, which is not built yet — until then
            the source is read-only rather than an editor that quietly compiles
            nothing.{" "}
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
          <Backdrop
            sx={styles.stage}
            label={`${current.name}.tsx and the CSS the compiler wrote for it`}
          >
            <div sx={styles.windows}>
              <EditorWindow file={`${current.name}.tsx`} path="src/examples">
                <div sx={styles.scroll}>
                  <EditorLines html={current.sourceHtml} />
                </div>
                {current.diagnostics.length > 0 ? (
                  <div sx={styles.problems} aria-label="Problems">
                    {current.diagnostics.map((diagnostic) => (
                      <span
                        key={`${diagnostic.line}-${diagnostic.code}`}
                        sx={styles.problem}
                      >
                        <Icon
                          icon={Alert02Icon}
                          size="0.8125rem"
                          sx={styles.problemIcon}
                        />
                        <span>
                          {diagnostic.message}{" "}
                          <span sx={styles.problemWhere}>
                            kirana({diagnostic.name}) [Ln {diagnostic.line}]
                          </span>
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div sx={styles.status}>
                  <span sx={styles.statusItem}>
                    <Icon icon={CheckmarkCircle02Icon} size="0.75rem" />
                    {current.diagnostics.length} diagnostics
                  </span>
                  <span>TypeScript JSX</span>
                </div>
              </EditorWindow>
              <EditorWindow file="kirana.css" path="dist">
                <div sx={styles.scroll}>
                  <EditorLines html={current.cssHtml} />
                </div>
                <div sx={styles.status}>
                  <span>{current.classNames.length} classes</span>
                  <span>engine: {engine.id}</span>
                  <span>CSS</span>
                </div>
              </EditorWindow>
            </div>
          </Backdrop>
        ) : null}
      </PageSection>
    </Page>
  )
}
