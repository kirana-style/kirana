/**
 * An editor window, drawn the way Kirana's extension looks in a dark theme: a title
 * bar with traffic lights and the file's path, numbered lines, and the summary the
 * language server writes after an element's line — Kirana's mark (the petal K, in its brand
 * gradients), then each part in
 * its group's colour (layout blue, box green, size cyan, colour orange, type yellow,
 * border purple; never red, which reads as an error).
 *
 * The window is dark in both colour schemes, as most editors are, and sets
 * `color-scheme: dark`, so highlighted code inside it takes the dark side of every
 * `light-dark()` token colour. Docs blocks marked `editor` render through it, and
 * the homepage's showcase builds its scenes from the same pieces.
 */
import { css } from "@kirana-style/core"
import { SourceCodeIcon } from "@hugeicons/core-free-icons"

import {
  CodeBlock,
  TrafficLights,
} from "@workspace/docs-ui/markdown/code-block.tsx"
import type { CodeBlockProps } from "@workspace/docs-ui/markdown/code-block.tsx"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { KiranaMark } from "@/brand/kirana-mark-svg"

/** The editor's own colours: one dark theme, whatever the page's scheme. */
export const EDITOR = {
  background: "#1e2024",
  bar: "#27292e",
  sidebar: "#222429",
  border: "rgb(255 255 255 / 0.08)",
  text: "#d7dce4",
  muted: "#7d8590",
  gutter: "#4f5664",
  selection: "rgb(110 140 230 / 0.22)",
  current: "rgb(255 255 255 / 0.035)",
}

/** The summary's groups, as the extension colours them in a dark theme. */
export const GROUP = {
  layout: css({ color: "#8cbbf0" }),
  box: css({ color: "#9fd4ad" }),
  size: css({ color: "#7fd3dc" }),
  colour: css({ color: "#e8b98a" }),
  type: css({ color: "#e6d37f" }),
  border: css({ color: "#c9aef0" }),
  quiet: css({ color: EDITOR.muted }),
}
export type Group = keyof typeof GROUP

const GROUPS: readonly [RegExp, Group][] = [
  [
    /^(▦|⇶|grid|flex|block|inline|hidden|gap|items|justify|place|cols|rows|order)\b/,
    "layout",
  ],
  [
    /^(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|inset|top|left|right|bottom)\b/,
    "box",
  ],
  [/^(w|h|size|max-w|min-w|max-h|min-h|aspect)\b/, "size"],
  [/^(text \d|font|leading|tracking|\d00\b|italic|uppercase)/, "type"],
  [/^(border|rounded|ring|outline|divide)\b/, "border"],
  [/^(bg|color|ink|fill|stroke|text|shadow|opacity)\b/, "colour"],
]

/** A part's group, from its first word once a guard (`md:`, `on:`) is set aside. */
export function groupOf(part: string): Group {
  const word = part.replace(/^[\w-]+:\s+/, "")
  return GROUPS.find(([pattern]) => pattern.test(word))?.[1] ?? "quiet"
}

const styles = {
  window: css({
    colorScheme: "dark",
    position: "relative",
    overflow: "hidden",
    borderRadius: "0.75rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgb(255 255 255 / 0.1)",
    backgroundColor: EDITOR.background,
    color: EDITOR.text,
    boxShadow:
      "0 0 0 1px rgb(0 0 0 / 0.25), 0 2px 6px rgb(0 0 0 / 0.12), 0 28px 60px -24px rgb(0 0 0 / 0.55)",
  }),
  bar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    height: "2.25rem",
    paddingInline: spacing["3.5"],
    backgroundColor: EDITOR.bar,
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: EDITOR.border,
    fontSize: "0.75rem",
    color: EDITOR.muted,
    whiteSpace: "nowrap",
  }),
  path: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
  }),
  file: css({ color: EDITOR.text }),
  tabs: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[1],
    minWidth: 0,
  }),
  tab: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    flexShrink: 0,
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[1],
    borderRadius: radius.sm,
  }),
  tabOn: css({
    backgroundColor: "rgb(255 255 255 / 0.08)",
    color: EDITOR.text,
  }),
  code: css({
    margin: 0,
    paddingBlock: spacing[3],
    overflowX: "auto",
    fontFamily: fontFamily.mono,
    fontSize: "0.8125rem",
    lineHeight: "1.75",
    scrollbarWidth: "thin",
  }),
  line: css({
    display: "flex",
    alignItems: "center",
    minWidth: "max-content",
    paddingInlineEnd: spacing[4],
    whiteSpace: "pre",
  }),
  number: css({
    flexShrink: 0,
    width: "3rem",
    paddingInlineEnd: spacing[4],
    textAlign: "end",
    color: EDITOR.gutter,
    userSelect: "none",
  }),
  hint: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45em",
    marginInlineStart: spacing[4],
    paddingInline: "0.5em",
    paddingBlock: "0.05em",
    borderRadius: radius.sm,
    backgroundColor: "rgb(255 255 255 / 0.06)",
    fontSize: "0.92em",
    whiteSpace: "nowrap",
  }),
  mark: css({ height: "0.95em" }),
  dot: css({ color: EDITOR.gutter }),
}

/** The window: title bar with traffic lights and the file's path, then the body. */
export function EditorWindow({
  path,
  file,
  tabs,
  extra,
  sx,
  children,
}: {
  /** Folders before the file, shown muted: `src / components`. */
  path?: string
  file: string
  /** Open files, shown as tabs with `file` active, in place of the path. */
  tabs?: readonly string[]
  /** Anything at the bar's end. */
  extra?: React.ReactNode
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <div sx={[styles.window, sx]} data-slot="editor-window">
      <div sx={styles.bar}>
        <TrafficLights />
        {tabs ? (
          <span sx={styles.tabs}>
            {tabs.map((tab) => (
              <span
                key={tab}
                sx={[styles.tab, tab === file ? styles.tabOn : null]}
              >
                {tab === file ? (
                  <Icon icon={SourceCodeIcon} size="0.75rem" />
                ) : null}
                {tab}
              </span>
            ))}
          </span>
        ) : (
          <span sx={styles.path}>
            <Icon icon={SourceCodeIcon} size="0.8125rem" />
            {path ? `${path} / ` : null}
            <span sx={styles.file}>{file}</span>
          </span>
        )}
        {extra}
      </div>
      {children}
    </div>
  )
}

/** The summary the language server writes after a line, split at its ` · `. */
export function Hint({ text, sx }: { text: string; sx?: Sx }) {
  const parts = text.split(" · ")
  return (
    <span sx={[styles.hint, sx]} data-slot="editor-hint">
      <KiranaMark title={null} sx={styles.mark} />
      {parts.map((part, index) => (
        <span key={`${index}-${part}`}>
          {index > 0 ? <span sx={styles.dot}>· </span> : null}
          <span sx={GROUP[groupOf(part)]}>{part}</span>
        </span>
      ))}
    </span>
  )
}

/** Highlighted lines, numbered, each followed by its hint when it has one. */
export function EditorLines({
  html,
  hints = [],
  start = 1,
}: {
  html: string
  hints?: readonly { line: number; text: string }[]
  start?: number
}) {
  const lines = html.split("\n")
  return (
    <pre sx={styles.code} data-slot="code-block-source">
      <code>
        {lines.map((line, index) => {
          const hint = hints.find((entry) => entry.line === index)
          return (
            <span key={index} sx={styles.line}>
              <span sx={styles.number}>{index + start}</span>
              <span dangerouslySetInnerHTML={{ __html: line || " " }} />
              {hint ? <Hint text={hint.text} /> : null}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

/** The site's code block: `editor` blocks as an editor window, the rest as docs-ui draws them. */
export function SiteCodeBlock(props: CodeBlockProps) {
  if (props.variant !== "editor") return <CodeBlock {...props} />
  const file = props.file ?? props.title ?? `example.${props.lang}`
  const slash = file.lastIndexOf("/")
  return (
    <EditorWindow
      sx={css({ marginBlockEnd: spacing[5] })}
      path={slash > 0 ? file.slice(0, slash).replaceAll("/", " / ") : undefined}
      file={file.slice(slash + 1)}
    >
      <EditorLines html={props.html} hints={JSON.parse(props.hints ?? "[]")} />
    </EditorWindow>
  )
}
