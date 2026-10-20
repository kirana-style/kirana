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

/**
 * The site's own windows (the homepage showcase, the migrate page): one dark theme, whatever the
 * page's scheme, drawn from the site's night (the dark side of `theme.background` and
 * `theme.card`), so a window sits in the page instead of on it.
 */
export const EDITOR = {
  /** The page's night: title bars, previews and terminals. */
  deep: "oklch(0.165 0.008 70)",
  /** The window's body. */
  sidebar: "oklch(0.185 0.009 70)",
  /** Code panes: the night's card. */
  background: "oklch(0.2 0.009 70)",
  bar: "oklch(0.225 0.01 70)",
  border: "oklch(0.97 0.01 85 / 8%)",
  text: "oklch(0.9 0.008 85)",
  muted: "oklch(0.68 0.012 80)",
  gutter: "oklch(0.62 0.01 75)",
  selection: "oklch(0.82 0.1 85 / 18%)",
  current: "oklch(0.97 0.01 85 / 3.5%)",
}

/**
 * The editor window's chrome (`EditorWindow`): a neutral dark editor theme, as VS Code shows it.
 * The editor scenes, the docs' `editor` code blocks and the extension's marketplace images are
 * drawn in it, so it imitates the editor rather than the site.
 */
const CHROME = {
  background: "#1e2024",
  bar: "#27292e",
  border: "rgb(255 255 255 / 0.08)",
  text: "#d7dce4",
  // GitHub Dark's secondary text, 4.7 : 1 on the bar.
  muted: "#8b949e",
  // The line numbers, as `VSCODE.lineNumber` below.
  gutter: "#848d97",
}

/**
 * VS Code's colours with the GitHub Dark theme, the theme the docs' code blocks use: what the
 * extension's decorations, hovers and webview resolve their theme variables to there.
 */
export const VSCODE = {
  foreground: "#c9d1d9",
  hover: "#161b22",
  sidebar: "#010409",
  border: "#30363d",
  link: "#58a6ff",
  codeBlock: "rgb(110 118 129 / 0.4)",
  codeLens: "#8b949e",
  // A step lighter than GitHub Dark's line numbers (`#6e7681`, 3.6 : 1 on the editor's
  // background), so they read at 4.8 : 1.
  lineNumber: "#848d97",
  lineHighlight: "rgb(110 118 129 / 0.1)",
  badge: "#1f6feb",
  button: "#238636",
  error: "#f85149",
}

/**
 * The summary's groups in the extension's palette (`editors/brand/palette.json`), resolved for
 * GitHub Dark: `charts.blue`, `charts.green`, `terminal.ansiCyan`, `charts.orange`,
 * `charts.yellow`, `charts.purple`; the separators and `+N` in the inlay hint colour.
 */
export const GROUP = {
  layout: css({ color: "#58a6ff" }),
  box: css({ color: "#3fb950" }),
  size: css({ color: "#39c5cf" }),
  colour: css({ color: "#db6d28" }),
  type: css({ color: "#d29922" }),
  border: css({ color: "#bc8cff" }),
  quiet: css({ color: VSCODE.codeLens }),
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
    backgroundColor: CHROME.background,
    color: CHROME.text,
    boxShadow:
      "0 0 0 1px rgb(0 0 0 / 0.25), 0 2px 6px rgb(0 0 0 / 0.12), 0 28px 60px -24px rgb(0 0 0 / 0.55)",
  }),
  bar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    height: "2.25rem",
    paddingInline: spacing["3.5"],
    backgroundColor: CHROME.bar,
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: CHROME.border,
    fontSize: "0.75rem",
    color: CHROME.muted,
    whiteSpace: "nowrap",
  }),
  path: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
  }),
  file: css({ color: CHROME.text }),
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
    color: CHROME.text,
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
    color: CHROME.gutter,
    userSelect: "none",
  }),
  // As the extension draws it: decorations after the line, the icon first, with no background of
  // their own. At full opacity rather than the extension's 0.85 (`kirana.inlayHints.opacity`),
  // which leaves the orange and grey groups under 4.5 : 1 on this background.
  hint: css({
    display: "inline-flex",
    alignItems: "center",
    marginInlineStart: "1ch",
    whiteSpace: "pre",
  }),
  mark: css({
    width: "0.9em",
    height: "0.9em",
    marginInlineEnd: "0.5ch",
  }),
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

/** The extension's icon, as it leads a summary or a folded object. */
export function HintMark({ sx }: { sx?: Sx }) {
  return <KiranaMark title={null} sx={[styles.mark, sx]} />
}

/**
 * The summary the language server writes after a line. `parts` are the server's own, each with
 * its group; a docs block's `//:` hint is `text`, split at its ` · ` and grouped by its words.
 */
export function Hint({
  text,
  parts,
  sx,
}: {
  text?: string
  parts?: readonly { text: string; group: string }[]
  sx?: Sx
}) {
  const shown =
    parts ??
    (text ?? "")
      .split(" · ")
      .map((part) => ({ text: part, group: groupOf(part) }))
  return (
    <span sx={[styles.hint, sx]} data-slot="editor-hint">
      <HintMark />
      {shown.map((part, index) => (
        <span key={`${index}-${part.text}`}>
          {index > 0 ? <span sx={GROUP.quiet}> · </span> : null}
          <span sx={GROUP[part.group as Group] ?? GROUP.quiet}>
            {part.text}
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * Highlighted markup cut into lines, each one whole: a token that runs on (a comment over two
 * lines) is closed at the end of a line and opened again at the start of the next. Cut at the
 * newline alone, a line would hold an unclosed `<span>` that the browser closes its own way, and
 * the page would hydrate differently from the server's markup.
 */
export function splitLines(html: string): string[] {
  const lines: string[] = []
  const open: string[] = []
  let line = ""
  for (const part of html.split(/(<\/?span[^>]*>|\n)/)) {
    if (part === "\n") {
      lines.push(line + "</span>".repeat(open.length))
      line = open.join("")
    } else {
      if (part.startsWith("<span")) open.push(part)
      else if (part === "</span>") open.pop()
      line += part
    }
  }
  lines.push(line)
  return lines
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
  const lines = splitLines(html)
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
