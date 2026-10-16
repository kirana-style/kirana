import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  FileScriptIcon,
  Layers01Icon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { NextStep } from "@/components/site/accents"
import { BenchChart } from "@/components/site/bench-chart"
import { RUNTIME_SIZE } from "@/data/benchmarks"
import { chapter } from "@/components/site/chapter"
import { DiagnosticFamilies } from "@/components/site/evidence"
import { Tools } from "@/components/site/tools"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"
import { FrameworkGrid } from "@/components/site/framework-grid"
import { Card, CardGrid, Figures, Steps } from "@/components/site/cards"
import { Accent, Page, PageHero, PageSection } from "@/components/site/page"
import { PipelineArt } from "@/components/art/compiler-art"
import { InlineCode } from "@/components/site/code-tokens"

export const Route = createFileRoute("/compiler")({
  component: CompilerPage,
  head: () => ({
    meta: [
      { title: "The compiler · Kirana" },
      {
        name: "description",
        content:
          "Kirana reads your modules at build time, writes one stylesheet, and rewrites the modules to reference classes. Nothing styles your page at runtime.",
      },
    ],
  }),
})

/** The pipeline, as `/docs/start/how-it-works` states it. */
const PIPELINE = [
  {
    title: "Prefilter",
    text: "Before parsing anything, the adapter skips every module whose text contains neither @kirana-style/ nor an sx attribute, so the work scales with styled modules, not the dependency graph.",
  },
  {
    title: "Evaluate",
    text: "What feeds a style is evaluated at build time: constants, imported tokens, template literals, simple functions, across files. Anything it cannot evaluate is reported, not guessed.",
  },
  {
    title: "Normalise",
    text: "Declarations become longhands, so two styles that touch the same box merge per side rather than per shorthand.",
  },
  {
    title: "Atomise",
    text: "Each declaration becomes one rule with one class, named by hashing property, value and conditions. Two modules that write display: flex share a class.",
  },
  {
    title: "Order",
    text: "Atoms are placed in layers, ordered by a stated precedence ladder: more conditions win, then the narrower declaration. Specificity never carries intent.",
  },
  {
    title: "Rewrite",
    text: "css({ … }) becomes a class string and sx becomes className. A runtime value becomes a choice between classes or a custom-property bridge.",
  },
]

const styles = {
  flow: css({
    height: "14rem",
    overflowX: "auto",
    overflowY: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  split: css({
    display: "grid",
    gap: spacing[10],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 1fr)",
    },
  }),
  note: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

function CompilerPage() {
  return (
    <Page scene="crater-lake">
      <PageHero
        label="The compiler"
        title={
          <>
            Styles in, <Accent>one stylesheet</Accent> out.
          </>
        }
        lede="Kirana reads your modules at build time, works out every style they can produce, writes one stylesheet, and rewrites the modules to reference classes instead of style objects."
        actions={
          <>
            <Button
              size="lg"
              nativeButton={false}
              render={
                <DocsLink href="/docs/start/quick-start">Quick start</DocsLink>
              }
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={
                <DocsLink href="/docs/start/how-it-works">
                  How it works
                </DocsLink>
              }
            />
          </>
        }
      />

      <PageSection
        number="01"
        label="Pipeline"
        title="Six steps, all at build time"
        lede="Between the file you write and the stylesheet the browser loads."
      >
        <div sx={styles.flow}>
          <PipelineArt />
        </div>
        <div sx={styles.split}>
          <Steps items={PIPELINE.slice(0, 3)} />
          <Steps items={PIPELINE.slice(3)} start={4} />
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="Output"
        title="What the browser receives"
        lede={`The only runtime code is a private helper under ${RUNTIME_SIZE}, included only in modules that merge styles at runtime or bridge a value. It merges class strings; it never generates CSS.`}
      >
        <CardGrid>
          <Card icon={FileScriptIcon} title="One stylesheet">
            The atoms your application actually uses, minified through Lightning
            CSS and lowered for your browser targets.
          </Card>
          <Card icon={SourceCodeIcon} title="Class strings">
            In your JavaScript, where the style objects were. The same sources
            produce byte-identical CSS.
          </Card>
          <Card icon={Layers01Icon} title="Layers you control">
            Every rule sits in a layer, so your reset stays below Kirana's and
            nothing is emitted unlayered.
          </Card>
        </CardGrid>
      </PageSection>

      <PageSection
        number="03"
        label="Scale"
        title="Proportional to your styling"
        lede="Measured on the shadcn/ui port's demo applications."
      >
        <Figures
          items={[
            {
              value: "99.3 %",
              label:
                "of 7,747 modules in the demo's build rejected before parsing",
            },
            {
              value: "0.05 s",
              label: "engine time over 370 modules: packages/ui and three apps",
            },
            { value: "44 MB", label: "peak engine memory over that build" },
            {
              value: "36.8 ms",
              label: "median from saving a file to the updated stylesheet",
            },
          ]}
        />
        <p sx={styles.note}>
          One developer machine, advisory. From{" "}
          <InlineCode>
            packages/kirana/design-notes/benchmark-results.md
          </InlineCode>
          , where the method is written down.
        </p>
      </PageSection>

      <PageSection
        id="measured"
        number="04"
        label="Measured"
        title="Against the same apps, built three ways"
        lede="The three demo applications, built three ways by kirana-lab on every release: with the published Kirana, as the StyleX port (by StyleX's Babel plugin and by its SWC compiler) and as the Tailwind original. Every one passes the same conformance checks before it is timed."
      >
        <BenchChart />
      </PageSection>

      <PageSection
        number="05"
        label="Diagnostics"
        title="Mistakes that used to be silent"
        lede={`${DIAGNOSTICS.length} diagnostics with stable codes and help text, and kirana-style trace to ask which declaration wins a property and which rule decided it.`}
        aside={
          <DocsLink href="/docs/tooling/diagnostics" sx={chapter.aside}>
            Every diagnostic
          </DocsLink>
        }
      >
        <DiagnosticFamilies />
      </PageSection>

      <PageSection
        number="06"
        label="Tooling"
        title="The tools around the compiler"
        lede="The command line, files and skills for coding agents, editors and lint, each linking to its documentation."
      >
        <Tools />
      </PageSection>

      <PageSection
        number="07"
        label="Frameworks"
        title="With the framework you already use"
        lede="Every guide is installed from the packed packages and built on every change."
      >
        <FrameworkGrid />
      </PageSection>

      <PageSection
        number="08"
        label="Limits"
        title="What it leaves to you"
        lede="Three lines the compiler does not cross, so the result stays something you can predict."
      >
        <CardGrid>
          <Card title="Generate CSS in the browser">
            Every rule exists before the page loads. The runtime helper only
            merges class strings.
          </Card>
          <Card title="Guess from class names">
            Which style wins comes from a stated ladder, not from reading class
            names or source order.
          </Card>
          <Card title="Style markup it cannot see">
            A component from a package is styled from the outside, with a
            contextual selector or compiled props.
          </Card>
        </CardGrid>
      </PageSection>

      <PageSection flush>
        <NextStep
          title="See a component compile"
          actions={
            <Button
              size="lg"
              nativeButton={false}
              render={<DocsLink href="/play">Open the playground</DocsLink>}
            />
          }
        >
          The playground shows examples the compiler in this repository compiled
          when the site was built: the source, the CSS and the classes, nothing
          written by hand.
        </NextStep>
      </PageSection>
    </Page>
  )
}
