import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  Alert02Icon,
  CpuIcon,
  Flag01Icon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { framed } from "@/components/site/framed-card"
import { EditorScene } from "@/components/home/editor"
import { Choices } from "@/components/home/flexible"
import { Faq } from "@/components/site/faq"
import { NextStep } from "@/components/site/accents"
import { ThenAndNow } from "@/components/site/evidence"
import { Principles } from "@/components/site/packages"
import { Card, CardGrid } from "@/components/site/cards"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { BuildArt, RuntimeArt } from "@/components/art/why-art"
import { InlineCode } from "@/components/site/code-tokens"
import { CLAIMS } from "@/data/benchmarks"

export const Route = createFileRoute("/why")({
  component: WhyPage,
  head: () => ({
    meta: [
      { title: "Why Kirana" },
      {
        name: "description",
        content:
          "Runtime CSS-in-JS earned its reputation. Writing styles next to components did not. Why Kirana compiles them instead.",
      },
    ],
  }),
})

const styles = {
  // The same body text as the rest of the site: base size, relaxed leading,
  // muted, with links and lead-ins in the foreground.
  prose: css({
    display: "grid",
    gap: spacing[4],
    fontSize: fontSize.base,
    lineHeight: "1.75",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  link: css({
    color: theme.foreground,
    textDecorationLine: "underline",
    textDecorationStyle: "dashed",
    textDecorationColor: accent.base,
    textUnderlineOffset: "4px",
  }),
  // The editor beside what it answers: the mock, then the prose, side by side on wide screens.
  seeing: css({
    display: "grid",
    gap: spacing[8],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1.2fr) minmax(0, 1fr)",
    },
    alignItems: "start",
  }),
  figure: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  panel: css({
    display: "grid",
    gridTemplateRows: "16rem auto",
    margin: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
  }),
  panelCopy: css({ display: "grid", gap: spacing[1], padding: spacing[5] }),
  panelTitle: css({
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
  }),
  panelText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  // A pull quote drawn as a selected box in a design tool: a thin accent frame
  // with square handles at the corners.
  selection: css({
    position: "relative",
    marginBlock: spacing[6],
    marginInline: 0,
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[8] },
    paddingBlock: spacing[6],
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: accent.base,
    backgroundColor: tint(6),
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize.xl, [breakpoint.md]: fontSize["2xl"] },
    lineHeight: "1.45",
    fontWeight: fontWeight.normal,
    textWrap: "balance",
  }),
  handle: css({
    position: "absolute",
    width: "9px",
    height: "9px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: accent.base,
    backgroundColor: theme.background,
  }),
  tl: css({ insetBlockStart: "-5px", insetInlineStart: "-5px" }),
  tr: css({ insetBlockStart: "-5px", insetInlineEnd: "-5px" }),
  bl: css({ insetBlockEnd: "-5px", insetInlineStart: "-5px" }),
  br: css({ insetBlockEnd: "-5px", insetInlineEnd: "-5px" }),
  size: css({
    position: "absolute",
    insetBlockEnd: "-1.75rem",
    insetInlineEnd: 0,
    borderRadius: "3px",
    backgroundColor: accent.base,
    color: accent.on,
    paddingInline: spacing["1.5"],
    fontFamily: fontFamily.mono,
    fontSize: "0.625rem",
    lineHeight: "1.125rem",
    fontWeight: fontWeight.medium,
  }),
}

function Selection({ children }: { children: React.ReactNode }) {
  return (
    <blockquote sx={styles.selection}>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <span
          key={corner}
          sx={[styles.handle, styles[corner]]}
          aria-hidden="true"
        />
      ))}
      <span sx={styles.size} aria-hidden="true">
        verdict
      </span>
      {children}
    </blockquote>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <DocsLink href={href} sx={styles.link}>
      {children}
    </DocsLink>
  )
}

function WhyPage() {
  return (
    <Page scene="highlands">
      <PageHero
        label="Why Kirana"
        title={
          <>
            Styles next to components, <Accent>without the cost.</Accent>
          </>
        }
        lede={`"CSS-in-JS" means two different things, and most of the dislike is for the first one.`}
      />
      <PageSection
        number="01"
        label="History"
        title="Why teams walked away from CSS-in-JS"
      >
        <div sx={styles.prose}>
          <p>
            The first generation (styled-components, Emotion and their
            relatives) turned styles into CSS in the browser, while rendering.
            Every component serialised its styles, hashed them and inserted a
            rule. That meant work on every render, a styling library in every
            bundle, and server rendering that had to collect styles into the
            HTML.
          </p>
          <p>
            React's own documentation says runtime injection{" "}
            <A href="https://react.dev/reference/react/useInsertionEffect">
              forces the browser to recalculate styles a lot more often
            </A>
            , and recommends static CSS files plus inline styles for dynamic
            values. GitHub's Primer moved its components from styled-components
            to CSS Modules and{" "}
            <A href="https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/">
              reports 55 % less time to server-render a page
            </A>
            .
          </p>
        </div>
        <Selection>
          That is a verdict on runtime CSS-in-JS. It is not a verdict on writing
          styles next to components.
        </Selection>
        <ThenAndNow />
      </PageSection>

      <PageSection
        number="02"
        label="The change"
        title="A compiler moves the work to the build"
        lede="The same style objects, read at build time instead of while rendering."
      >
        <div sx={styles.figure}>
          <figure sx={[framed.inset, styles.panel]}>
            <div sx={framed.picture}>
              <RuntimeArt />
            </div>
            <figcaption sx={styles.panelCopy}>
              <span sx={styles.panelTitle}>While rendering</span>
              <span sx={styles.panelText}>
                Each component turns its styles into a rule and inserts it, in
                every browser, on every render that needs one.
              </span>
            </figcaption>
          </figure>
          <figure sx={[framed.inset, styles.panel]}>
            <div sx={framed.picture}>
              <BuildArt />
            </div>
            <figcaption sx={styles.panelCopy}>
              <span sx={styles.panelTitle}>At build time</span>
              <span sx={styles.panelText}>
                The compiler reads every module once and writes one stylesheet;
                the browser only applies class names.
              </span>
            </figcaption>
          </figure>
        </div>
        <div sx={styles.prose}>
          <p>
            Nothing about styling happens in the browser except applying class
            names, which is what the React team recommends. Kirana is that kind,
            and adds what a StyleX port of the same app showed: declared{" "}
            <A href="/docs/styling/relations">relations</A> the compiler checks,{" "}
            <A href="/docs/styling/merging">merging per entry</A>, one{" "}
            <A href="/docs/styling/precedence">precedence ladder</A>, and{" "}
            <A href="/docs/tooling/diagnostics">diagnostics</A> for the mistakes
            that used to be silent.
          </p>
        </div>
      </PageSection>

      <PageSection
        number="03"
        label="Principles"
        title="Three promises, and what keeps them"
        lede="Each promise links to the page that shows how it is kept."
      >
        <Principles />
      </PageSection>

      <PageSection
        number="04"
        label="Choices"
        title="Yours to decide, and easy for an agent"
        lede="How you write, how strict the build is and where it runs are up to you; and what you write is easy for a model to write, check and fix."
      >
        <Choices />
      </PageSection>

      <PageSection
        number="05"
        label="In the editor"
        title="The CSS is on the line again"
        lede="The other reason teams left CSS-in-JS: the class list was gone, so nobody could read what an element gets."
      >
        <div sx={styles.seeing}>
          <EditorScene feature="summary" />
          <div sx={styles.prose}>
            <p>
              A Tailwind class list is the CSS, written where the element is.
              Object styles moved it into another place, behind a name, and
              reading a component meant jumping to find out what{" "}
              <InlineCode>styles.card</InlineCode> does.
            </p>
            <p>
              Kirana&apos;s <A href="/docs/tooling/editor">language server</A>{" "}
              puts it back: every element&apos;s line ends with what it gets, in
              a class list&apos;s words, coloured by kind. Hover it for the box
              model, every declaration and the compiled rule; turn{" "}
              <InlineCode>:hover</InlineCode> on in the inspector; fold a long
              object into its summary. It answers from the build&apos;s own
              compiler, so it is never a guess.
            </p>
            <p>
              And you keep what object styles are for: types that reject a typo
              before it ships, atomic output (one rule per distinct declaration,
              shared by every element), and a Rust compiler that built the
              shadcn/ui port&apos;s three apps{" "}
              <A href="/compiler#measured">
                {CLAIMS.buildTailwind} and {CLAIMS.buildStylex}
              </A>
              , measured in public on every release.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection
        number="06"
        label="Costs"
        title="What it costs you"
        lede="A compiler is a trade. These are the parts you pay for."
      >
        <CardGrid cols={4}>
          <Card icon={Flag01Icon} title="It is before 1.0">
            A minor version may still change the API, and its release notes say
            how to move. The status page lists what works today.
          </Card>
          <Card icon={CpuIcon} title="It is a compiler">
            Styles must be statically known in shape; a value it cannot
            enumerate goes through a custom property.
          </Card>
          <Card icon={Alert02Icon} title="It is stricter than CSS">
            Two conditions that tie are reported instead of left to source
            order, which is why a migration needs a few hand fixes.
          </Card>
          <Card icon={SourceCodeIcon} title="The richest editor is VS Code">
            Every LSP editor gets the card, the hints and the fixes; the Style
            Inspector, Style Fold and coloured hints are VS Code&apos;s.
          </Card>
        </CardGrid>
      </PageSection>

      <PageSection number="07" label="Questions" title="Asked before you ask">
        <Faq />
      </PageSection>

      <PageSection flush>
        <NextStep
          title="The long version, with every source"
          actions={
            <Button
              size="lg"
              nativeButton={false}
              render={
                <DocsLink href="/docs/start/why-kirana">
                  Read why Kirana
                </DocsLink>
              }
            />
          }
        >
          Including the objections, "it doubles the code" and "why not Tailwind
          and cn()", answered with measurements.
        </NextStep>
      </PageSection>
    </Page>
  )
}
