/**
 * "For agents": what a coding agent runs while it writes styles, and what the compiler answers it.
 * Three cards follow the loop the agent skill teaches (learn the names, check what was written, find
 * why a style looks wrong), each drawing a command and the lines it printed; under them, a table of
 * the other commands, each with what it answers. Nothing in a drawing is typed by hand: every
 * command ran on `showcase/project/` when the site was generated (`runs.gen`).
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon, CommandLineIcon } from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize, fontWeight } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { InlineCode } from "@/components/site/code-tokens"
import { IllustratedCard } from "@/components/site/illustrated-card"
import { Card, Row, T } from "@/components/site/visuals"
import { LISTS, sentence } from "@/data/facts"
import { RUNS } from "@/generated/runs.gen"

import { HomeSection } from "./frame"

const styles = {
  cards: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  window: css({ width: "min(20rem, 100%)" }),
  // A value may be longer than the window: it wraps under its key instead of being cut.
  value: css({
    minWidth: 0,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  }),
  table: css({
    display: "grid",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  row: css({
    display: "grid",
    alignItems: "baseline",
    gap: { base: spacing[1], [breakpoint.md]: spacing[6] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr) auto",
      [breakpoint.md]: "10rem minmax(0, 1.1fr) minmax(0, 1.4fr) auto",
    },
    paddingInline: spacing[5],
    paddingBlock: spacing[4],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    textDecorationLine: "none",
    color: theme.foreground,
    backgroundColor: { base: "transparent", ":is(a):hover": tint(5) },
  }),
  task: css({ fontWeight: fontWeight.medium }),
  command: css({
    gridColumn: { base: "1 / -1", [breakpoint.md]: "auto" },
    gridRow: { base: "2", [breakpoint.md]: "auto" },
  }),
  answer: css({
    color: theme.mutedForeground,
    gridColumn: { base: "1 / -1", [breakpoint.md]: "auto" },
    gridRow: { base: "3", [breakpoint.md]: "auto" },
  }),
  arrow: css({
    justifySelf: "end",
    gridColumn: { base: "2", [breakpoint.md]: "auto" },
    gridRow: { base: "1", [breakpoint.md]: "auto" },
    color: { base: theme.mutedForeground, ":is(a:hover *)": accent.base },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
}

type Json = Record<string, unknown>

/** The first diagnostic `check --format json` printed for the misspelt property. */
export const FIRST_DIAGNOSTIC = (JSON.parse(RUNS.check.output) as Json[])[0]!
/** The first token `export` printed. */
const TOKEN = ((JSON.parse(RUNS.export.output) as Json).tokens as Json[])[0]!
/** The entry `trace --format json` says wins. */
const WINNER = (
  (JSON.parse(RUNS.traceJson.output) as Json[])[0]!.entries as Json[]
)[0]!

/**
 * A terminal window: the command, then the fields of one object of its JSON, in the order given,
 * each as the command printed it. A field the command did not print is left out, so the drawing
 * follows the compiler when its output gains or loses one.
 */
export function JsonArt({
  command,
  value,
  keys,
  open,
  close,
}: {
  command: string
  value: Json
  keys: readonly string[]
  open: string
  close: string
}) {
  const shown = keys.filter((key) => key in value)
  return (
    <Card title="~/app" icon={CommandLineIcon} glow sx={styles.window}>
      <Row flat typed={0}>
        <T tone="prompt">$</T>
        <span sx={styles.value}>
          <T tone="strong">{command}</T>
        </span>
      </Row>
      <Row flat typed={1}>
        <T tone="muted">{open}</T>
      </Row>
      {shown.map((key, index) => (
        <Row key={key} flat typed={index + 2}>
          <T tone="info">{`  "${key}":`}</T>
          <span sx={styles.value}>
            <T
              tone={key === "help" || key === "origin" ? "success" : undefined}
            >
              {JSON.stringify(value[key])}
            </T>
          </span>
        </Row>
      ))}
      <Row flat typed={shown.length + 2}>
        <T tone="muted">{close}</T>
      </Row>
    </Card>
  )
}

/** The other commands, each with the job it does and what it answers. */
const MORE: readonly {
  task: string
  command: string
  answer: string
  href: string
}[] = [
  {
    task: "Learn the rules",
    command: "npx skills add kirana-style/kirana",
    answer: `Installs the ${sentence(LISTS.skills)} skills: the rules that cause real bugs, this loop, and every diagnostic with what to do about it.`,
    href: "/docs/project/agent-skills",
  },
  {
    task: "Read the docs",
    command: "/llms.txt",
    answer:
      "One line per page with a link to its markdown twin; /llms-full.txt is every page in one file. The skills link to the same pages.",
    href: "/docs/project/llms",
  },
  {
    task: "Gate a pull request",
    command: "kirana-style check src --format github",
    answer:
      "An annotation on each line with a diagnostic. With --max-warnings 0, a warning fails the run too.",
    href: "/docs/tooling/cli#kirana-style-check",
  },
  {
    task: "Clean up",
    command: "kirana-style analyze src",
    answer:
      "Tokens nothing reads, atoms by how many places apply them, and bytes by layer and by module; --html writes the report as one page.",
    href: "/docs/tooling/cli#kirana-style-analyze",
  },
  {
    task: "Add components",
    command: "kirana-style ui mcp",
    answer:
      "A Model Context Protocol server over stdio: the project's registries, searching and viewing items, their files and the add command.",
    href: "/docs/tooling/cli#kirana-style-ui",
  },
  {
    task: "Move a codebase",
    command: "kirana-style migrate tailwind src",
    answer:
      "A diff and a report of what it would not decide; --write applies it. Also stylex, css-modules and styled-components (Emotion too).",
    href: "/docs/migration/from-tailwind",
  },
]

export function Agents() {
  return (
    <HomeSection
      id="agents"
      number="03"
      eyebrow="For agents"
      title="Your agent writes it. The compiler checks it."
      lede="A coding agent learns the names your project has, writes the style, and reads the compiler's answer as JSON. Each drawing is a real command on a small project and the lines it printed."
    >
      <div sx={styles.cards}>
        <IllustratedCard
          tall
          art={
            <JsonArt
              command={RUNS.export.command}
              value={TOKEN}
              keys={["identity", "light", "dark", "origin"]}
              open={'{ "tokens": [{'}
              close="}, …] }"
            />
          }
          title="Learn the names"
          note="export"
          text="The design system as JSON: every token with its light and dark values and the line that declares it, and the themes, recipes and relations, so an agent writes names that exist."
          links={[
            {
              title: "kirana-style export",
              href: "/docs/tooling/cli#kirana-style-export",
            },
          ]}
        />
        <IllustratedCard
          tall
          art={
            <JsonArt
              command={RUNS.check.command}
              value={FIRST_DIAGNOSTIC}
              keys={["code", "line", "message", "help"]}
              open="[{"
              close="}]"
            />
          }
          title="Check what it wrote"
          note="check"
          text="A misspelt property or condition, a length without its unit or a relation read without its anchor fails with a stable code and the line; a misspelt keyword is a warning. Where the fix is certain, help names it, the nearest valid name for a misspelling."
          links={[
            { title: "Diagnostics", href: "/docs/tooling/diagnostics" },
            {
              title: "What is not caught",
              href: "/docs/styling/styles#what-the-compiler-checks",
            },
          ]}
        />
        <IllustratedCard
          tall
          art={
            <JsonArt
              command={RUNS.traceJson.command}
              value={WINNER}
              keys={["value", "conditions", "step", "reason"]}
              open={'[{ "entries": [{'}
              close="}, …] }]"
            />
          }
          title="Find why it looks wrong"
          note="trace"
          text="For a style that compiles and still looks wrong: every entry for the property at that line, the one that wins, and the step of the precedence ladder that decided it. Several questions go in one compile."
          links={[
            { title: "Debugging", href: "/docs/tooling/debugging" },
            { title: "Agent skills", href: "/docs/project/agent-skills" },
          ]}
        />
      </div>
      <div sx={styles.table} data-slot="agent-commands">
        {MORE.map((item) => (
          <DocsLink key={item.task} href={item.href} sx={styles.row}>
            <span sx={styles.task}>{item.task}</span>
            <span sx={styles.command}>
              <InlineCode>{item.command}</InlineCode>
            </span>
            <span sx={styles.answer}>{item.answer}</span>
            <Icon icon={ArrowRight01Icon} size="0.875rem" sx={styles.arrow} />
          </DocsLink>
        ))}
      </div>
    </HomeSection>
  )
}
