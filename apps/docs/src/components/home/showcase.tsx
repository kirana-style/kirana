/**
 * "Source in, CSS out": six tabs, each a real file and what the compiler did with it, drawn as
 * one dark editor window whose panes change with the job. A compile shows the source, a terminal
 * running the build, the rendered result and the `kirana.css` it wrote; a diagnostic shows the
 * source and the terminal; a migration shows the file before and after, and the command.
 *
 * The terminal types its command, then prints what the compiler prints (`kirana build` ends with
 * its diagnostic count, `kirana check` with the diagnostics themselves), and the stylesheet streams
 * in line by line. Switching tabs replays it; under reduced motion everything is simply there.
 * Nothing in a pane is written by hand: sources, CSS and diagnostics come from the build.
 */
import { useState } from "react"
import { css, keyframes } from "@kirana-style/core"
import {
  AlertDiamondIcon,
  ArrowRight01Icon,
  ArrowDataTransferHorizontalIcon,
  CodeIcon,
  GitMergeIcon,
  LinkSquare02Icon,
  PaintBoardIcon,
} from "@hugeicons/core-free-icons"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { TrafficLights } from "@workspace/docs-ui/markdown/code-block.tsx"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { radius } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { ExamplePreview } from "@/components/markdown/example"
import { EDITOR } from "@/components/site/editor-window"
import { EXAMPLES } from "@/generated/examples.gen"
import { SHOWCASE } from "@/generated/showcase.gen"

import { HomeSection } from "./frame"

type Tab = {
  id: string
  label: string
  icon: IconProps["icon"]
  accent: AccentName
  caption: string
  href: string
}

const TABS: readonly Tab[] = [
  {
    id: "compile",
    label: "Compile",
    icon: CodeIcon,
    accent: "orange",
    caption:
      "Conditions sit inside the value they change. Each declaration becomes one class, shared by every module that writes it.",
    href: "/docs/start/how-it-works",
  },
  {
    id: "merge",
    label: "Merge",
    icon: GitMergeIcon,
    accent: "blue",
    caption:
      "A later handle replaces the entries it names and keeps the rest: the quiet button takes a new base and hover colour, and keeps the shape.",
    href: "/docs/styling/merging",
  },
  {
    id: "relations",
    label: "Relations",
    icon: LinkSquare02Icon,
    accent: "violet",
    caption:
      "Style one element from another's state. The relation is declared once, the anchor sits on the element that has the state, and the compiler checks both ends.",
    href: "/docs/styling/relations",
  },
  {
    id: "tokens",
    label: "Tokens",
    icon: PaintBoardIcon,
    accent: "emerald",
    caption:
      "A token is a typed constant. With variable: true it becomes a custom property that a subtree can override — one light-dark() pair, no dark variant.",
    href: "/docs/tokens/overview",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: AlertDiamondIcon,
    accent: "pink",
    caption:
      "The anchor was left off, so the chevron would never rotate. In a class string that fails silently; here the build stops and says why.",
    href: "/docs/tooling/diagnostics",
  },
  {
    id: "migrate",
    label: "Migrate",
    icon: ArrowDataTransferHorizontalIcon,
    accent: "amber",
    caption:
      "kirana migrate tailwind rewrote this class string, dark variant included. Anything it cannot decide goes into a report instead of a guess.",
    href: "/docs/migration/from-tailwind",
  },
]

/** Which compiled example each live tab shows. */
const EXAMPLE_FOR: Record<string, string> = {
  compile: "compile-card",
  merge: "button-variants",
  relations: "relation-field",
  tokens: "tokens-theme",
}

/** How fast the terminal types, and how fast the stylesheet streams in. */
const CHAR_MS = 28
const LINE_MS = 22

const REDUCED = "@media (prefers-reduced-motion: reduce)"

/** A typed line: its width grows a character at a time (`steps()` set per line). */
const type = keyframes({
  from: { width: "0ch" },
  to: { width: "var(--chars)" },
})
/** Output appearing once the command finishes. */
const appear = keyframes({
  from: { opacity: 0, translate: "0 3px" },
  to: { opacity: 1, translate: "0 0" },
})
const blink = keyframes({
  "0%, 49%": { opacity: 1 },
  "50%, 100%": { opacity: 0 },
})

/** The window's areas for each layout, on wide screens; narrow ones stack the panes. */
const LAYOUT = {
  build: css({
    gridTemplateColumns: {
      [breakpoint.lg]: "minmax(0, 1.1fr) minmax(0, 1fr)",
    },
    gridTemplateRows: { [breakpoint.lg]: "auto minmax(0, 1fr) auto" },
    gridTemplateAreas: {
      [breakpoint.lg]: '"source preview" "source output" "terminal output"',
    },
  }),
  check: css({
    gridTemplateColumns: {
      [breakpoint.lg]: "minmax(0, 1.1fr) minmax(0, 1fr)",
    },
    gridTemplateRows: { [breakpoint.lg]: "minmax(0, 1fr)" },
    gridTemplateAreas: { [breakpoint.lg]: '"source terminal"' },
  }),
  migrate: css({
    gridTemplateColumns: {
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 1fr)",
    },
    gridTemplateRows: { [breakpoint.lg]: "minmax(0, 1fr) auto" },
    gridTemplateAreas: {
      [breakpoint.lg]: '"source output" "terminal terminal"',
    },
  }),
}

const AREA = {
  source: css({ gridArea: { [breakpoint.lg]: "source" } }),
  preview: css({ gridArea: { [breakpoint.lg]: "preview" } }),
  output: css({ gridArea: { [breakpoint.lg]: "output" } }),
  terminal: css({ gridArea: { [breakpoint.lg]: "terminal" } }),
}

const styles = {
  // One window, dark in both schemes: a title bar with the lights and the examples as browser
  // tabs, then the caption and the panes. `color-scheme` takes every token inside to its dark side.
  shell: css({
    colorScheme: "dark",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgb(255 255 255 / 0.1)",
    backgroundColor: EDITOR.sidebar,
    color: EDITOR.text,
    boxShadow:
      "0 0 0 1px rgb(0 0 0 / 0.2), 0 2px 6px rgb(0 0 0 / 0.1), 0 28px 60px -24px rgb(0 0 0 / 0.5)",
  }),
  titleBar: css({
    display: "flex",
    alignItems: "flex-end",
    gap: spacing[2],
    paddingInlineStart: spacing[4],
    paddingInlineEnd: spacing[2],
    paddingBlockStart: spacing[2],
    backgroundColor: "#16171b",
  }),
  lights: css({
    alignSelf: "center",
    paddingInlineEnd: spacing[2],
    paddingBlockEnd: spacing[2],
  }),
  tabList: css({
    display: "flex",
    gap: "2px",
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  // A browser tab: the open one takes the window's colour and joins the body below it.
  tab: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    flexShrink: 0,
    paddingInline: spacing["3.5"],
    paddingBlock: spacing[2],
    borderStartStartRadius: "0.5rem",
    borderStartEndRadius: "0.5rem",
    backgroundColor: {
      base: "transparent",
      ":hover": "rgb(255 255 255 / 0.04)",
    },
    color: { base: EDITOR.muted, ":hover": EDITOR.text },
    fontSize: "0.8125rem",
    fontWeight: fontWeight.medium,
    cursor: "pointer",
    outlineStyle: { base: "none", ":focus-visible": "solid" },
    outlineWidth: "2px",
    outlineOffset: "-2px",
    outlineColor: accent.base,
    transitionProperty: "background-color, color",
    transitionDuration: "150ms",
  }),
  tabOn: css({
    backgroundColor: { base: EDITOR.sidebar, ":hover": EDITOR.sidebar },
    color: { base: EDITOR.text, ":hover": EDITOR.text },
  }),
  tabIcon: css({ color: accent.base }),
  // One quiet line under the tabs: what the window shows, and where to read more.
  caption: css({
    paddingInline: { base: spacing[4], [breakpoint.md]: spacing[5] },
    paddingBlockStart: spacing[3],
    paddingBlockEnd: spacing[1],
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: EDITOR.muted,
    textWrap: "pretty",
  }),
  readHow: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["0.5"],
    marginInlineStart: spacing[2],
    whiteSpace: "nowrap",
    fontWeight: fontWeight.medium,
    color: accent.base,
    textDecorationLine: { base: "none", ":hover": "underline" },
    textUnderlineOffset: "3px",
  }),

  // The editor window: dark in both schemes, its panes separated by the frame's own colour.
  window: css({
    display: "grid",
    gap: "6px",
    height: { base: "auto", [breakpoint.lg]: "34rem" },
    padding: "6px",
    backgroundColor: EDITOR.sidebar,
    color: EDITOR.text,
  }),
  pane: css({
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: EDITOR.border,
    backgroundColor: EDITOR.background,
  }),
  paneBar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[1],
    minWidth: 0,
    height: "2.25rem",
    paddingInline: spacing[2],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: EDITOR.border,
    backgroundColor: EDITOR.bar,
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  fileTab: css({
    flexShrink: 0,
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[1],
    borderRadius: radius.sm,
    fontFamily: fontFamily.sans,
    fontSize: "0.75rem",
    color: EDITOR.muted,
    whiteSpace: "nowrap",
  }),
  paneNote: css({
    marginInlineStart: "auto",
    paddingInline: spacing[2],
    fontSize: "0.6875rem",
    color: EDITOR.muted,
    whiteSpace: "nowrap",
  }),
  fileTabOn: css({
    backgroundColor: "rgb(255 255 255 / 0.08)",
    color: EDITOR.text,
  }),
  scroll: css({
    minHeight: 0,
    overflow: "auto",
    maxHeight: { base: "22rem", [breakpoint.lg]: "none" },
    scrollbarWidth: "thin",
    scrollbarColor: `${EDITOR.gutter} transparent`,
  }),
  code: css({
    margin: 0,
    paddingBlock: spacing[3],
    fontFamily: fontFamily.mono,
    fontSize: "0.78rem",
    lineHeight: "1.7",
    tabSize: 2,
  }),
  line: css({
    display: "flex",
    minWidth: "max-content",
    paddingInlineEnd: spacing[4],
    whiteSpace: "pre",
  }),
  number: css({
    flexShrink: 0,
    width: "2.75rem",
    paddingInlineEnd: spacing[3],
    textAlign: "end",
    color: EDITOR.gutter,
    userSelect: "none",
  }),
  // A line of the stylesheet arriving after the build.
  streamed: css({
    animationName: { base: appear, [REDUCED]: "none" },
    animationDuration: "180ms",
    animationTimingFunction: "ease-out",
    animationFillMode: "both",
  }),
  // The rendered result, in its dark side like everything in the window.
  preview: css({
    display: "grid",
    placeItems: "center",
    minHeight: "8.5rem",
    padding: spacing[5],
    backgroundColor: "#16171b",
    color: EDITOR.text,
  }),
  terminal: css({
    margin: 0,
    padding: spacing[3],
    whiteSpace: "pre-wrap",
    fontFamily: fontFamily.mono,
    fontSize: "0.78rem",
    lineHeight: "1.7",
    color: EDITOR.text,
  }),
  command: css({ display: "flex", whiteSpace: "pre" }),
  prompt: css({ color: "#7ee787" }),
  typed: css({
    display: "inline-block",
    // Its own width, always: on a narrow pane the line scrolls instead of cutting the command.
    flexShrink: 0,
    overflow: "hidden",
    verticalAlign: "bottom",
    width: { base: "var(--chars)" },
    animationName: { base: type, [REDUCED]: "none" },
    animationFillMode: "both",
  }),
  caret: css({
    display: "inline-block",
    width: "0.55em",
    height: "1.1em",
    marginInlineStart: "1px",
    verticalAlign: "-0.2em",
    backgroundColor: EDITOR.text,
    animationName: { base: blink, [REDUCED]: "none" },
    animationDuration: "1s",
    animationTimingFunction: "steps(1)",
    animationIterationCount: "infinite",
  }),
  error: css({ color: "#ff7b72", fontWeight: fontWeight.semibold }),
  muted: css({ color: EDITOR.muted }),
  help: css({ color: "#79c0ff" }),
}

/** Numbered, highlighted lines; `stream` makes them arrive one after another from that delay. */
function Lines({ html, stream }: { html: string; stream?: number }) {
  const lines = html.replace(/\n$/, "").split("\n")
  return (
    <pre sx={styles.code} data-slot="code-block-source">
      <code>
        {lines.map((line, index) => (
          <span
            key={index}
            sx={[styles.line, stream === undefined ? null : styles.streamed]}
            style={
              stream === undefined
                ? undefined
                : { animationDelay: `${stream + index * LINE_MS}ms` }
            }
          >
            <span sx={styles.number}>{index + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: line || " " }} />
          </span>
        ))}
      </code>
    </pre>
  )
}

/** A pane: a bar of file tabs, then its body. */
function Pane({
  tabs,
  note,
  area,
  children,
}: {
  tabs: readonly string[]
  /** Muted words at the bar's end: what the file is, not another file. */
  note?: string
  area: keyof typeof AREA
  children: React.ReactNode
}) {
  return (
    <section sx={[styles.pane, AREA[area]]} aria-label={tabs[0]}>
      <div sx={styles.paneBar}>
        {tabs.map((tab, index) => (
          <span
            key={tab}
            sx={[styles.fileTab, index === 0 ? styles.fileTabOn : null]}
          >
            {tab}
          </span>
        ))}
        {note ? <span sx={styles.paneNote}>{note}</span> : null}
      </div>
      <div sx={styles.scroll}>{children}</div>
    </section>
  )
}

/** How long typing these commands takes, in milliseconds. */
const typingTime = (commands: readonly string[]) =>
  commands.reduce((total, command) => total + command.length * CHAR_MS + 250, 0)

/** A terminal: each command typed in turn, then what it printed. */
function Terminal({
  commands,
  children,
}: {
  commands: readonly string[]
  children?: React.ReactNode
}) {
  // Each command starts once the ones before it are typed; the output follows the last.
  const starts = commands.map(
    (_, index) => 150 + typingTime(commands.slice(0, index))
  )
  const end = 150 + typingTime(commands)
  return (
    <pre sx={styles.terminal}>
      {commands.map((command, index) => {
        const delay = starts[index]!
        return (
          <span key={command} sx={styles.command}>
            <span sx={styles.prompt}>$ </span>
            <span
              sx={styles.typed}
              style={
                {
                  "--chars": `${command.length}ch`,
                  animationDuration: `${command.length * CHAR_MS}ms`,
                  animationDelay: `${delay}ms`,
                  animationTimingFunction: `steps(${command.length})`,
                } as React.CSSProperties
              }
            >
              {command}
            </span>
          </span>
        )
      })}
      {children ? (
        <span
          sx={styles.streamed}
          style={{ display: "block", animationDelay: `${end}ms` }}
        >
          {children}
        </span>
      ) : null}
      <span sx={styles.caret} />
    </pre>
  )
}

function BuildWindow({ name }: { name: string }) {
  const example = EXAMPLES[name]!
  const file = `src/examples/${name}.tsx`
  const commands = [`kirana build ${file} --out kirana.css`]
  const errors = example.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error"
  ).length
  return (
    <div sx={[styles.window, LAYOUT.build]}>
      <Pane tabs={[`${name}.tsx`]} area="source">
        <Lines html={example.sourceHtml} />
      </Pane>
      <Pane tabs={["Preview"]} area="preview">
        <div sx={styles.preview}>
          <ExamplePreview name={name} />
        </div>
      </Pane>
      <Pane tabs={["kirana.css"]} area="output">
        <Lines html={example.cssHtml} stream={typingTime(commands) + 200} />
      </Pane>
      <Pane tabs={["Terminal"]} area="terminal">
        <Terminal commands={commands}>
          <span sx={styles.muted}>
            {example.diagnostics.length} diagnostic(s), {errors} error(s)
          </span>
        </Terminal>
      </Pane>
    </div>
  )
}

function CheckWindow() {
  const snippet = SHOWCASE.diagnostic!
  return (
    <div sx={[styles.window, LAYOUT.check]}>
      <Pane tabs={["menu.tsx"]} area="source">
        <Lines html={snippet.html} />
      </Pane>
      <Pane tabs={["Terminal"]} area="terminal">
        <Terminal commands={["kirana check menu.tsx"]}>
          {snippet.diagnostics.map((diagnostic) => (
            <span key={diagnostic.code + diagnostic.message}>
              <span sx={styles.error}>error[{diagnostic.code}]</span>{" "}
              {diagnostic.name}: {diagnostic.message}
              {"\n"}
              <span sx={styles.muted}>{"  --> menu.tsx"}</span>
              {"\n"}
              {diagnostic.help.map((line) => (
                <span key={line} sx={styles.help}>
                  help: {line}
                  {"\n"}
                </span>
              ))}
            </span>
          ))}
          <span sx={styles.muted}>
            {snippet.diagnostics.length} diagnostic(s),{" "}
            {snippet.diagnostics.length} error(s)
          </span>
        </Terminal>
      </Pane>
    </div>
  )
}

/** The commands the migration guide gives, without their comments. */
const MIGRATE_COMMANDS = SHOWCASE["migrate-tailwind-command"]!.source.split(
  "\n"
)
  .map((line) => line.replace(/\s+#.*$/, "").trim())
  .filter((line) => line.includes("--write") || line.startsWith("kirana check"))

function MigrateWindow() {
  return (
    <div sx={[styles.window, LAYOUT.migrate]}>
      <Pane tabs={["card.tsx"]} note="before · Tailwind" area="source">
        <Lines html={SHOWCASE["migrate-before"]!.html} />
      </Pane>
      <Pane tabs={["card.tsx"]} note="after · Kirana" area="output">
        <Lines
          html={SHOWCASE["migrate-after"]!.html}
          stream={typingTime(MIGRATE_COMMANDS.slice(0, 1)) + 200}
        />
      </Pane>
      <Pane tabs={["Terminal"]} area="terminal">
        <Terminal commands={MIGRATE_COMMANDS} />
      </Pane>
    </div>
  )
}

export function Showcase() {
  const [value, setValue] = useState(TABS[0]!.id)
  const tab = TABS.find((item) => item.id === value) ?? TABS[0]!

  // ← and → move between the tabs, Home and End to the ends, as a tab list does.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = TABS.findIndex((item) => item.id === value)
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : -1
    if (next < 0) return
    event.preventDefault()
    setValue(TABS[next]!.id)
    document.getElementById(`showcase-tab-${TABS[next]!.id}`)?.focus()
  }

  return (
    <HomeSection
      accent="orange"
      icon={CodeIcon}
      eyebrow="Source in, CSS out"
      title="Every panel is the compiler's own output"
      lede="Each tab is a file in this site and what the compiler in this repository made of it — generated at build time, never written by hand."
    >
      <div sx={[styles.shell, accents[tab.accent]]}>
        <div sx={styles.titleBar}>
          <span sx={styles.lights}>
            <TrafficLights />
          </span>
          <div
            role="tablist"
            aria-label="What the compiler does"
            sx={styles.tabList}
            onKeyDown={onKeyDown}
          >
            {TABS.map((item) => {
              const on = item.id === value
              return (
                <button
                  key={item.id}
                  id={`showcase-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="showcase-panel"
                  tabIndex={on ? 0 : -1}
                  sx={[
                    styles.tab,
                    accents[item.accent],
                    on ? styles.tabOn : null,
                  ]}
                  onClick={() => setValue(item.id)}
                >
                  <Icon icon={item.icon} size="0.875rem" sx={styles.tabIcon} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
        <div
          id="showcase-panel"
          role="tabpanel"
          aria-labelledby={`showcase-tab-${tab.id}`}
        >
          <p sx={styles.caption}>
            {tab.caption}
            <DocsLink href={tab.href} sx={styles.readHow}>
              Read how
              <Icon icon={ArrowRight01Icon} size="0.75rem" />
            </DocsLink>
          </p>
          {/* Keyed by the open tab, so the terminal types again whenever it is shown. */}
          {tab.id === "diagnostics" ? (
            <CheckWindow key={tab.id} />
          ) : tab.id === "migrate" ? (
            <MigrateWindow key={tab.id} />
          ) : (
            <BuildWindow key={tab.id} name={EXAMPLE_FOR[tab.id]!} />
          )}
        </div>
      </div>
    </HomeSection>
  )
}

/**
 * One of the showcase's scenes on a page of its own: the same window, with the open tab's label in
 * the title bar instead of the tab list, so a page shows the homepage's editor rather than drawing
 * another one.
 */
export function ShowcaseScene({ id }: { id: Tab["id"] }) {
  const tab = TABS.find((item) => item.id === id)!
  return (
    <div sx={[styles.shell, accents[tab.accent]]} data-slot="showcase-scene">
      <div sx={styles.titleBar}>
        <span sx={styles.lights}>
          <TrafficLights />
        </span>
        <span sx={styles.tabList}>
          <span sx={[styles.tab, styles.tabOn]}>
            <Icon icon={tab.icon} size="0.875rem" sx={styles.tabIcon} />
            {tab.label}
          </span>
        </span>
      </div>
      <p sx={styles.caption}>{tab.caption}</p>
      {id === "diagnostics" ? (
        <CheckWindow />
      ) : id === "migrate" ? (
        <MigrateWindow />
      ) : (
        <BuildWindow name={EXAMPLE_FOR[id]!} />
      )}
    </div>
  )
}
