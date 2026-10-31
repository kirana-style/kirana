/**
 * `/editor`: what Kirana's language server shows, for someone deciding whether to adopt Kirana. The
 * docs' editor page says how to set it up; this page says what it is worth. Every editor picture is
 * the server's own output (`EditorShowcase`, `EDITOR_SAMPLE`), and its one figure is `HEADLINES`'.
 */
import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"

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

import { DocsLink } from "@/components/docs-link"
import { EditorLines, EditorWindow } from "@/components/site/editor-window"
import { EditorShowcase } from "@/components/home/editor"
import { EditorGrid } from "@/components/markdown/tooling"
import { NextStep } from "@/components/site/accents"
import { chapter } from "@/components/site/chapter"
import { InlineCode } from "@/components/site/code-tokens"
import { QuickStart, SecondaryCta } from "@/components/site/cta"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { HEADLINES } from "@/data/benchmarks"
import { GITHUB, PLAYGROUND } from "@/data/links"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"
import { EDITOR_SAMPLE } from "@/generated/editor.gen"

export const Route = createFileRoute("/editor")({
  component: EditorPage,
  head: () => ({
    meta: [
      { title: "In your editor · Kirana" },
      {
        name: "description",
        content:
          "Kirana's language server shows every element's CSS on its line, explains which value wins, and reports the compiler's diagnostics as you type, in VS Code, Zed, Neovim, Helix and any LSP editor.",
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
  cellsTwo: css({
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
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
  code: css({
    display: "grid",
    gap: spacing[1],
    justifyItems: "start",
    minWidth: 0,
    overflowWrap: "anywhere",
  }),
  trade: css({ display: "grid", gap: spacing[8] }),
  answer: css({
    display: "grid",
    gap: { base: spacing[4], [breakpoint.lg]: spacing[10] },
    alignItems: "center",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 2fr) minmax(0, 3fr)",
    },
  }),
  answerCopy: css({ display: "grid", gap: spacing[3], alignContent: "start" }),
  value: css({
    fontFamily: fontFamily.numeric,
    fontSize: { base: fontSize["3xl"], [breakpoint.md]: fontSize["4xl"] },
    lineHeight: "1",
    fontWeight: fontWeight.medium,
    letterSpacing: "-0.02em",
    color: theme.foreground,
  }),
  source: css({
    justifySelf: "start",
    fontFamily: fontFamily.mono,
    fontSize: textSize.micro,
    lineHeight: textLeading.micro,
    letterSpacing: textTracking.micro,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
  }),
  list: css({
    display: "grid",
    gap: spacing[2],
    margin: 0,
    paddingInlineStart: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

/** The sample file's two elements with a summary, and the summaries the server wrote after them. */
const FIRST = EDITOR_SAMPLE.hints[0]!.line
const SUMMARIES = EDITOR_SAMPLE.hints.map((hint) => ({
  line: hint.line - FIRST,
  text: hint.parts.map((part) => part.text).join(" · "),
}))
const LINES = EDITOR_SAMPLE.lines
  .slice(FIRST, FIRST + SUMMARIES.length)
  .join("\n")

/** A hover's answer, measured (`HEADLINES`). */
const HOVER = HEADLINES.find((headline) => headline.id === "hover")!

/** The code actions the server offers beside a style, from the editor guide's list. */
const ACTIONS = [
  {
    title: "Extract to css()",
    text: "An inline css({…}) in an element's sx becomes a named handle above the component; Inline does the reverse for a handle used once.",
  },
  {
    title: "Vary at md, vary on :hover",
    text: "A plain value becomes { base: …, condition: … }, ready to change, with the condition keys completed weakest to strongest.",
  },
  {
    title: "Explain precedence",
    text: "Which entry wins the property under the cursor, and the step of the ladder that decided it.",
  },
  {
    title: "Convert Tailwind classes",
    text: "A className string becomes css(), with the engine of kirana-style migrate tailwind.",
  },
] as const

function EditorPage() {
  return (
    <Page scene="turquoise-lake">
      <PageHero
        label="In your editor"
        title={
          <>
            Every element&apos;s CSS, on its <Accent>line</Accent>
          </>
        }
        lede="Object styles moved the CSS out of the markup, and the class list went with it. Kirana's language server puts it back on every element, answered by the compiler your build runs, so what your editor says is what ships."
        actions={
          <>
            <QuickStart href="/docs/tooling/editor">
              Set up your editor
            </QuickStart>
            <SecondaryCta render={<DocsLink href={PLAYGROUND} />}>
              Try it in the playground
            </SecondaryCta>
          </>
        }
      />

      <PageSection
        number="01"
        label="The trade"
        title="Typed styles, and the class list back"
        lede="A class list shows what an element gets, where the element is; object styles gave that up for types. Kirana keeps the types and gives it back."
      >
        <div sx={styles.trade}>
          <div sx={[styles.cells, styles.cellsTwo]}>
            <div sx={styles.cell}>
              <span sx={styles.kicker}>A class list</span>
              <h3 sx={styles.heading}>You see it; nothing checks it</h3>
              <div sx={styles.code}>
                <InlineCode>{'className="grid gap-4 p-4 md:p-6"'}</InlineCode>
              </div>
              <p sx={styles.text}>
                What the element gets is on the element. A misspelled class is a
                class that does nothing, and the build says so nowhere.
              </p>
            </div>
            <div sx={styles.cell}>
              <span sx={styles.kicker}>A style object</span>
              <h3 sx={styles.heading}>Checked, and somewhere else</h3>
              <div sx={styles.code}>
                <InlineCode>{"sx={styles.card}"}</InlineCode>
              </div>
              <p sx={styles.text}>
                Typed, shared and refactored like code. To know what the element
                gets, you leave it and read the definition, then the merge.
              </p>
            </div>
          </div>
          <div sx={styles.answer}>
            <div sx={styles.answerCopy}>
              <span sx={styles.kicker}>Kirana in your editor</span>
              <h3 sx={styles.heading}>Checked, and on the line</h3>
              <p sx={styles.text}>
                After each element, the server writes what it gets, in a class
                list&apos;s words and coloured by kind, the breakpoint&apos;s
                value beside the base. These two summaries are its own, for the
                file the next chapter opens.
              </p>
            </div>
            <EditorWindow file={EDITOR_SAMPLE.file}>
              <EditorLines html={LINES} hints={SUMMARIES} start={FIRST + 1} />
            </EditorWindow>
          </div>
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="What it shows"
        title="One file, every answer the server gives"
        lede="Pick a feature. Each picture is kirana-style lsp's own answer for one file, drawn as VS Code draws it with the GitHub Dark theme: nothing in it is painted by hand."
      >
        <EditorShowcase />
      </PageSection>

      <PageSection
        number="03"
        label="Before the build"
        title="Mistakes and refactors, at the property"
        lede={`The compiler's ${DIAGNOSTICS.length} diagnostics appear as you type, at the property they are about, and the two with one exact fix offer it. Beside them, the refactors a style object needs.`}
        aside={
          <DocsLink
            href="/docs/tooling/editor#diagnostics-fixes-and-refactorings"
            sx={chapter.aside}
          >
            Every action
          </DocsLink>
        }
      >
        <div sx={[styles.cells, styles.cellsTwo]}>
          {ACTIONS.map((action) => (
            <div key={action.title} sx={styles.cell}>
              <h3 sx={styles.heading}>{action.title}</h3>
              <p sx={styles.text}>{action.text}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="04"
        label="Your editor"
        title="In the editor you already use"
        lede="An extension for VS Code and its forks, one for Zed, a few lines for Neovim and Helix, and kirana-style lsp over stdio for any other. It reads .tsx, .vue, .svelte and .astro."
      >
        <EditorGrid />
      </PageSection>

      <PageSection
        number="05"
        label="Under the hood"
        title="The build's engine, and where it stops"
        lede="The server is not a second implementation that can drift: it loads your project's own engine and kirana.config, so its answers are the build's."
      >
        <div sx={styles.cells}>
          <div sx={styles.cell}>
            <span sx={styles.value}>{HOVER.value}</span>
            <p sx={styles.text}>{HOVER.label}</p>
            <a
              href={`${GITHUB}/blob/main/${HOVER.link}`}
              target="_blank"
              rel="noreferrer"
              sx={styles.source}
            >
              {HOVER.source}
            </a>
          </div>
          <div sx={styles.cell}>
            <h3 sx={styles.heading}>One engine</h3>
            <p sx={styles.text}>
              The same compiler builds, lints and answers hovers. A rule the
              build would report is the one the editor underlines, under the
              same code.
            </p>
          </div>
          <div sx={styles.cell}>
            <h3 sx={styles.heading}>Where it stops</h3>
            <ul sx={styles.list}>
              <li>
                A value a function returns at runtime has no summary; an array
                of handles does.
              </li>
              <li>
                Vue, Svelte and Astro templates are read by a scanner, held to
                each framework&apos;s parser by a test.
              </li>
              <li>One project per server.</li>
            </ul>
          </div>
        </div>
      </PageSection>

      <PageSection flush>
        <NextStep
          title="Put it in your editor"
          actions={
            <QuickStart href="/docs/tooling/editor">
              Set up your editor
            </QuickStart>
          }
        >
          Install the extension or point your editor at kirana-style lsp. It
          starts with your project&apos;s engine and configuration, nothing else
          to set.
        </NextStep>
      </PageSection>
    </Page>
  )
}
