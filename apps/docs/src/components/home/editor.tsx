/**
 * "In your editor": what Kirana's extension shows, as a desktop you can look around.
 * A feature list on the left, picked by hovering it; on the right a framed scene — a dark
 * editor on one of Kirana's landscapes, behind frosted glass — that switches to the feature
 * picked: the summaries, the style card, the Style Inspector, Style Fold, a token's colours, a
 * diagnostic, and the editors it runs in.
 *
 * Nothing in the editor is drawn by hand. `scripts/generate-editor.ts` opens
 * `showcase/editor/plan.tsx` in `kirana-style lsp` and records its answers (`EDITOR_SAMPLE`): the code
 * lens and summaries are the server's, painted as the extension paints them; the hovers are the
 * HTML its Markdown renders to, in a frame styled as VS Code's hover; the Inspector is the
 * extension's own renderer. The colours are VS Code's with the GitHub Dark theme, the one the
 * docs' code blocks use.
 */
import { useState } from "react"
import { css, keyframes } from "@kirana-style/core"
import {
  Alert02Icon,
  ArrowUpRight01Icon,
  ColorsIcon,
  CursorMagicSelection02Icon,
  LayoutRightIcon,
  TextFontIcon,
  ViewOffSlashIcon,
  VisualStudioCodeIcon,
} from "@hugeicons/core-free-icons"

import { accent } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { Backdrop } from "@/components/site/backdrop"
import { EditorsGrid } from "@/components/site/editors-grid"
import {
  EditorWindow,
  Hint,
  HintMark,
  VSCODE,
} from "@/components/site/editor-window"
import { EDITOR_SAMPLE } from "@/generated/editor.gen"

import { HomeSection } from "./frame"

/** One row of the editor, in lines: a hover opens under the row it belongs to. */
const ROW = 1.8

const UI_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, Ubuntu, sans-serif'

/**
 * The frame a hover's HTML is shown in: VS Code's hover (and the Inspector's webview) with the
 * GitHub Dark theme — the theme variables the extension's own styles read, and the rules VS Code
 * applies to a Markdown hover. The HTML is the server's, unchanged.
 */
const FRAME_CSS = `
:root {
  color-scheme: dark;
  --vscode-foreground: ${VSCODE.foreground};
  --vscode-font-family: ${UI_FONT};
  --vscode-font-size: 13px;
  --vscode-editor-font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --vscode-sideBar-background: ${VSCODE.sidebar};
  --vscode-panel-border: ${VSCODE.border};
  --vscode-badge-background: ${VSCODE.badge};
  --vscode-badge-foreground: #f0f6fc;
  --vscode-button-background: ${VSCODE.button};
  --vscode-button-foreground: #ffffff;
  --vscode-textLink-foreground: ${VSCODE.link};
  --vscode-textCodeBlock-background: ${VSCODE.codeBlock};
}
html, body { margin: 0; }
body.hover { background: ${VSCODE.hover}; color: ${VSCODE.foreground}; font: 13px/1.5 var(--vscode-font-family); padding: 0 8px; }
body.hover p { margin: 8px 0; }
body.hover img { vertical-align: middle; }
body.hover code { font-family: var(--vscode-editor-font-family); font-size: 12px; background: ${VSCODE.codeBlock}; padding: 1px 3px; border-radius: 4px; }
body.hover pre { margin: 8px 0; white-space: pre; }
body.hover pre code { display: block; background: none; padding: 0; }
body.hover table { border-collapse: collapse; margin: 4px 0; }
body.hover th, body.hover td { padding: 0 8px 0 0; text-align: start; }
body.hover a { color: ${VSCODE.link}; cursor: pointer; }
.th-keyword { color: #ff7b72 } .th-string { color: #a5d6ff } .th-property, .th-attr, .th-number, .th-literal { color: #79c0ff }
.th-selector, .th-tag { color: #7ee787 } .th-function, .th-operator { color: #d2a8ff } .th-comment, .th-meta { color: #8b949e }
.th-type, .th-variable { color: #ffa657 }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: rgb(110 118 129 / 0.4); }
::-webkit-scrollbar-track { background: transparent; }
`

/** The Inspector's own stylesheet: the `<style>` of the extension's webview page. */
const INSPECTOR_CSS = `
body.view { color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font: var(--vscode-font-size) var(--vscode-font-family); padding: 0 12px 16px; }
code, .tag, small, .when { font-family: var(--vscode-editor-font-family); }
header .brand { width: 16px; height: 16px; flex: none; align-self: center; }
header { display: flex; gap: 8px; align-items: baseline; padding: 10px 0; border-bottom: 1px solid var(--vscode-panel-border); }
header code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .8; }
.kind { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.toggles, .scheme { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.chip { display: inline-flex; gap: 4px; align-items: center; font: inherit; font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--vscode-button-border, var(--vscode-panel-border)); color: var(--vscode-foreground); background: transparent; }
.chip.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: transparent; }
.chip .kind { background: transparent; color: inherit; opacity: .7; padding: 0; }
.box { margin: 12px 0; font-size: 11px; }
.box .tag { display: block; margin-bottom: 4px; opacity: .85; }
.margin { padding: 6px; border: 1px dashed #f97316; background: #f9731620; border-radius: 4px; }
.border { padding: 6px; border: 1px solid #ca8a04; background: #eab30824; }
.padding { padding: 6px; border: 1px solid #16a34a; background: #22c55e24; }
.content, .cell { padding: 8px; text-align: center; border: 1px solid #3b82f6; background: #3b82f62e; border-radius: 2px; min-height: 12px; }
.layout { margin: 6px 0; font-family: var(--vscode-editor-font-family); font-size: 12px; }
.colours ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.colours li { display: grid; grid-template-columns: 22px auto 1fr; gap: 8px; align-items: center; font-size: 12px; }
.swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); }
.colours code { text-align: end; opacity: .8; }
.type { display: flex; align-items: baseline; gap: 10px; margin: 12px 0; }
.group h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; margin: 14px 0 4px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
td { padding: 3px 4px; border-top: 1px solid var(--vscode-panel-border); vertical-align: top; }
td:first-child { opacity: .85; white-space: nowrap; }
tr.idle { opacity: .45; }
.when { font-size: 11px; padding: 0 4px; border-radius: 3px; background: var(--vscode-textCodeBlock-background); white-space: nowrap; }
`

const page = (body: string, kind: "hover" | "view") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${FRAME_CSS}${kind === "view" ? INSPECTOR_CSS : ""}</style></head><body class="${kind}">${body}</body></html>`

const styles = {
  layout: css({
    display: "grid",
    gap: { base: spacing[8], [breakpoint.lg]: spacing[12] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
    },
    alignItems: "center",
  }),

  // In a docs column: one column, the features as a row of chips above the scene.
  layoutCompact: css({
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr)",
    },
    gap: spacing[4],
    marginBlock: spacing[6],
  }),
  // The features as chips: in a docs column, and on the home page until the list fits beside the
  // scene (below `lg`), where seven titled rows would push the editor a screen down.
  optionsChips: css({
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing["1.5"],
  }),
  optionChip: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing[3],
    paddingBlock: spacing["1.5"],
    borderRadius: "999px",
  }),

  // The feature list beside the scene: quiet rows, the chosen one lifted onto a card; chips until
  // `lg`. A separate style from the chips, so neither inherits the other's `lg` entries.
  options: css({
    display: { base: "flex", [breakpoint.lg]: "grid" },
    flexWrap: "wrap",
    justifyContent: { base: "center", [breakpoint.lg]: "normal" },
    gap: spacing["1.5"],
    alignContent: "start",
  }),
  optionRow: css({
    display: { base: "flex", [breakpoint.lg]: "grid" },
    alignItems: { base: "center", [breakpoint.lg]: "normal" },
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: { base: spacing[2], [breakpoint.lg]: spacing[4] },
    paddingInline: { base: spacing[3], [breakpoint.lg]: spacing[5] },
    paddingBlock: { base: spacing["1.5"], [breakpoint.lg]: spacing[4] },
    borderRadius: { base: "999px", [breakpoint.lg]: "1.125rem" },
  }),
  option: css({
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: "transparent", ":hover": theme.border },
    backgroundColor: "transparent",
    textAlign: "start",
    color: theme.mutedForeground,
    cursor: "pointer",
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: "200ms",
  }),
  optionOn: css({
    borderColor: { base: theme.border, ":hover": theme.border },
    backgroundColor: theme.card,
    boxShadow:
      "0 1px 2px rgb(0 0 0 / 0.04), 0 12px 28px -18px rgb(0 0 0 / 0.25)",
  }),
  optionIcon: css({
    marginBlockStart: { base: "0", [breakpoint.lg]: "2px" },
    color: theme.mutedForeground,
  }),
  optionIconOn: css({ color: accent.base }),
  optionText: css({ display: "grid", gap: spacing[1] }),
  optionLabel: css({
    fontSize: "0.6875rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wider,
    textTransform: "uppercase",
  }),
  optionTitle: css({
    display: { base: "none", [breakpoint.lg]: "block" },
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),

  figure: css({ margin: 0, minWidth: 0, containerType: "inline-size" }),
  caption: css({
    marginBlockEnd: spacing[3],
    textAlign: "center",
    fontSize: fontSize.xs,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),

  // The editor's body: the code, and the Inspector's side bar beside it when it is open.
  body: css({
    display: "flex",
    flexWrap: { base: "wrap", [breakpoint.md]: "nowrap" },
    minHeight: { base: "auto", [breakpoint.md]: "24rem" },
  }),
  codeArea: css({ position: "relative", flex: 1, minWidth: 0 }),
  code: css({
    margin: 0,
    paddingBlock: spacing[3],
    overflowX: "auto",
    fontFamily: fontFamily.mono,
    fontSize: { base: "0.6875rem", [breakpoint.md]: "0.78rem" },
    lineHeight: String(ROW),
    color: VSCODE.foreground,
    scrollbarWidth: "none",
  }),
  line: css({
    display: "flex",
    alignItems: "center",
    minWidth: "max-content",
    paddingInlineEnd: spacing[4],
    whiteSpace: "pre",
  }),
  text: css({ whiteSpace: "pre" }),
  current: css({ backgroundColor: VSCODE.lineHighlight }),
  number: css({
    flexShrink: 0,
    width: "2.75rem",
    paddingInlineEnd: spacing[4],
    textAlign: "end",
    color: VSCODE.lineNumber,
    userSelect: "none",
  }),
  // A code lens: the line's commands above it, separated as VS Code separates them.
  lens: css({
    display: "block",
    paddingInlineStart: "2.75rem",
    fontFamily: UI_FONT,
    fontSize: "0.9em",
    color: VSCODE.codeLens,
    whiteSpace: "pre",
  }),
  // VS Code's colour decorator, before a colour value.
  swatch: css({
    display: "inline-block",
    width: "0.8em",
    height: "0.8em",
    marginInlineEnd: "0.3em",
    verticalAlign: "-0.05em",
    borderWidth: "0.1em",
    borderStyle: "solid",
    borderColor: VSCODE.foreground,
  }),
  squiggle: css({
    textDecorationLine: "underline",
    textDecorationStyle: "wavy",
    textDecorationColor: VSCODE.error,
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  }),
  // Style Fold's label in the object's place: the icon, then `{ summary }` in italics.
  fold: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4ch",
    color: VSCODE.codeLens,
    fontStyle: "italic",
  }),

  // A hover over the editor: VS Code's hover widget, opening under the row it belongs to.
  hover: css({
    position: { base: "relative", [breakpoint.md]: "absolute" },
    insetBlockStart: {
      base: "auto",
      [breakpoint.md]: `calc(var(--row) * ${ROW} * 0.78rem + 0.75rem)`,
    },
    // At its column, moved left as far as it must to stay inside the editor, as VS Code does.
    insetInlineStart: {
      base: "auto",
      [breakpoint.md]:
        "min(calc(2.75rem + var(--column) * 0.6 * 0.78rem), calc(100% - min(29rem, 86%) - 0.5rem))",
    },
    zIndex: 2,
    display: "grid",
    width: { base: "auto", [breakpoint.md]: "min(29rem, 86%)" },
    marginInline: { base: spacing[3], [breakpoint.md]: 0 },
    marginBlockEnd: { base: spacing[3], [breakpoint.md]: 0 },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: VSCODE.border,
    borderRadius: "3px",
    backgroundColor: VSCODE.hover,
    color: VSCODE.foreground,
    boxShadow: "0 0 8px 2px rgb(1 4 9 / 0.85)",
    overflow: "hidden",
    transitionProperty: "opacity",
    transitionDuration: {
      base: "100ms",
      "@media (prefers-reduced-motion: reduce)": "0s",
    },
  }),
  // Opening above its row, as VS Code opens a hover with no room below it.
  above: css({ translate: { base: "none", [breakpoint.md]: "0 -100%" } }),
  off: css({
    display: { base: "none", [breakpoint.md]: "grid" },
    opacity: 0,
    pointerEvents: "none",
  }),
  frame: css({
    display: "block",
    width: "100%",
    borderWidth: 0,
    backgroundColor: VSCODE.hover,
    colorScheme: "dark",
  }),
  // A diagnostic's hover: VS Code's own layout, with the server's message, code and fix.
  problem: css({
    paddingInline: "8px",
    paddingBlock: "6px",
    fontFamily: UI_FONT,
    fontSize: "13px",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
  }),
  problemCode: css({ color: VSCODE.codeLens }),
  statusBar: css({
    display: "flex",
    flexWrap: "wrap",
    columnGap: spacing[4],
    paddingInline: "8px",
    paddingBlock: "4px",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: VSCODE.border,
    fontFamily: UI_FONT,
    fontSize: "12px",
    color: VSCODE.link,
  }),

  // The Inspector: a side bar view, as VS Code shows the extension's webview.
  sidebar: css({
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    flexBasis: { base: "100%", [breakpoint.md]: "17rem" },
    flexShrink: 0,
    minHeight: { base: "24rem", [breakpoint.md]: "auto" },
    borderInlineStartWidth: "1px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: VSCODE.border,
    backgroundColor: VSCODE.sidebar,
  }),
  sidebarTitle: css({
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    fontFamily: UI_FONT,
    fontSize: "11px",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: VSCODE.foreground,
  }),
  sidebarFrame: css({ height: "100%" }),

  // The figure is a size container whose width is the one the stage's padding percentages read,
  // so the link can share the pane's right edge (spacing[3], then 6%) and sit centred in the band
  // below it (spacing[16], then 11%): a percentage inset would read the stage's height instead.
  closer: css({
    position: "absolute",
    insetInlineEnd: { base: spacing[3], [breakpoint.md]: "6cqi" },
    insetBlockEnd: { base: spacing[8], [breakpoint.md]: "5.5cqi" },
    translate: "0 50%",
    zIndex: 3,
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing["3.5"],
    paddingBlock: spacing[2],
    borderRadius: "999px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgb(255 255 255 / 0.55)",
    backgroundColor: "rgb(255 255 255 / 0.72)",
    backdropFilter: "blur(12px)",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: "#0a0a0a",
    textDecorationLine: "none",
  }),
}

const fadeIn = keyframes({
  from: { opacity: 0, translate: "0 4px" },
  to: { opacity: 1, translate: "0 0" },
})

const below = {
  description: css({
    display: "grid",
    gap: spacing[1],
    marginBlockStart: spacing[4],
    paddingInline: { base: spacing[1], [breakpoint.md]: spacing[2] },
    animationName: {
      base: fadeIn,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
    animationDuration: "260ms",
    animationTimingFunction: "ease-out",
  }),
  title: css({
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  text: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
}

type FeatureId =
  | "summary"
  | "card"
  | "inspector"
  | "fold"
  | "colours"
  | "lint"
  | "editors"

type Feature = {
  id: FeatureId
  icon: IconProps["icon"]
  label: string
  title: string
  text: string
  href: string
}

const FEATURES: readonly Feature[] = [
  {
    id: "summary",
    icon: TextFontIcon,
    label: "Inline summary",
    title: "Every element's CSS, on its line.",
    text: "What the element ends up with, in a class list's words and coloured by kind: layout, box, size, colour, type, border. Guards lead their values.",
    href: "/docs/tooling/editor#inline-summary",
  },
  {
    id: "card",
    icon: CursorMagicSelection02Icon,
    label: "Style card",
    title: "Hover for the whole story.",
    text: "The box model as DevTools draws it, every declaration with rem in pixels and the token it reads, the values under a breakpoint, and the compiled rules.",
    href: "/docs/tooling/editor#the-style-card",
  },
  {
    id: "inspector",
    icon: LayoutRightIcon,
    label: "Style Inspector",
    title: "Turn :hover and md on.",
    text: "A panel that follows the cursor. Toggle a condition or a guard and it shows what applies then: the compiler's answer, not a guess.",
    href: "/docs/tooling/editor#style-inspector-vs-code",
  },
  {
    id: "fold",
    icon: ViewOffSlashIcon,
    label: "Style Fold",
    title: "Long objects, read short.",
    text: "A one-line style object reads as its summary until the cursor reaches it, like Tailwind Fold, for objects.",
    href: "/docs/tooling/editor#style-fold-vs-code",
  },
  {
    id: "colours",
    icon: ColorsIcon,
    label: "Colours",
    title: "Every colour, where it is used.",
    text: "A swatch beside every colour literal and colour token, and on hover the token's value, with both sides of light-dark() when it has two.",
    href: "/docs/tooling/editor#colours",
  },
  {
    id: "lint",
    icon: Alert02Icon,
    label: "Diagnostics",
    title: "Wrong styles, caught as you type.",
    // consistency: subset — Biome cannot run the compiler's diagnostics
    text: "The compiler's own diagnostics at the property, with a fix one keystroke away. The same checks run under Oxlint and ESLint.",
    href: "/docs/tooling/diagnostics",
  },
  {
    id: "editors",
    icon: VisualStudioCodeIcon,
    label: "Everywhere",
    title: "Your editor, your framework.",
    text: "VS Code and its forks, Zed, Neovim and Helix, in .tsx, .vue, .svelte and .astro, each running your project's own engine.",
    href: "/docs/tooling/editor#pick-your-editor",
  },
]

const SAMPLE = EDITOR_SAMPLE

/** One row of the code: a line of the file, or the code lens above one. */
type Row =
  | { kind: "lens"; titles: readonly string[] }
  | {
      kind: "line"
      index: number
      number: number
      html: string
      added?: boolean
    }

/** The rows the editor shows for a feature: Diagnostics adds the line it reports. */
function rows(feature: FeatureId): Row[] {
  const out: Row[] = []
  let number = 0
  SAMPLE.lines.forEach((html, index) => {
    const lens = SAMPLE.lenses.find((entry) => entry.line === index)
    if (lens) out.push({ kind: "lens", titles: lens.titles })
    out.push({ kind: "line", index, number: ++number, html })
    if (feature === "lint" && index === SAMPLE.problem.line - 1) {
      out.push({
        kind: "line",
        index: SAMPLE.problem.line,
        number: ++number,
        html: SAMPLE.lintLine.html,
        added: true,
      })
    }
  })
  return out
}

/** The row a file line sits on, counting the lenses above it. */
function rowOf(list: readonly Row[], line: number, added = false) {
  return list.findIndex(
    (row) =>
      row.kind === "line" &&
      row.index === line &&
      (row.added ?? false) === added
  )
}

/** The line with a colour token: VS Code's colour decorator before the token. */
function TokenLine({ html }: { html: string }) {
  const at = html.lastIndexOf("color")
  return (
    <span sx={styles.text}>
      <span dangerouslySetInnerHTML={{ __html: html.slice(0, at) }} />
      <span sx={styles.swatch} style={{ backgroundColor: "#0af" }} />
      <span dangerouslySetInnerHTML={{ __html: html.slice(at) }} />
    </span>
  )
}

/** The component in the editor, as the extension draws it for the chosen feature. */
function Code({ feature, list }: { feature: FeatureId; list: readonly Row[] }) {
  const cardLine = SAMPLE.anchors.card.line
  const tokenLine = SAMPLE.anchors.token.line
  return (
    <pre sx={styles.code} data-slot="code-block-source">
      <code>
        {list.map((row, position) => {
          if (row.kind === "lens") {
            return (
              <span key={`lens-${position}`} sx={styles.lens}>
                {row.titles.join(" | ")}
              </span>
            )
          }
          const added = row.added === true
          const hint = added
            ? undefined
            : SAMPLE.hints.find((entry) => entry.line === row.index)
          const folded =
            feature === "fold" && !added && row.index === SAMPLE.fold.line
          const current =
            ((feature === "card" || feature === "inspector") &&
              row.index === cardLine &&
              !added) ||
            (feature === "colours" && row.index === tokenLine && !added) ||
            (feature === "lint" && added) ||
            folded
          return (
            <span
              key={`line-${position}`}
              sx={[styles.line, current ? styles.current : null]}
            >
              <span sx={styles.number}>{row.number}</span>
              {folded ? (
                <span sx={styles.text}>
                  <span
                    dangerouslySetInnerHTML={{ __html: SAMPLE.fold.before }}
                  />
                  <span sx={styles.fold}>
                    <HintMark />
                    {`{ ${SAMPLE.fold.summary} }`}
                  </span>
                  <span
                    dangerouslySetInnerHTML={{ __html: SAMPLE.fold.after }}
                  />
                </span>
              ) : added ? (
                <span sx={styles.text}>
                  {"  "}
                  <span
                    sx={styles.squiggle}
                    dangerouslySetInnerHTML={{
                      __html: row.html.trimStart().replace(/,$/, ""),
                    }}
                  />
                  ,
                </span>
              ) : row.index === tokenLine ? (
                <TokenLine html={row.html} />
              ) : (
                <span
                  sx={styles.text}
                  dangerouslySetInnerHTML={{ __html: row.html || " " }}
                />
              )}
              {hint && !folded ? <Hint parts={hint.parts} /> : null}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

/** A hover's HTML in a frame of its own, so neither the page's styles nor its own leak. */
function Frame({
  html,
  kind,
  title,
  height,
}: {
  html: string
  kind: "hover" | "view"
  title: string
  height?: string
}) {
  return (
    <iframe
      title={title}
      srcDoc={page(html, kind)}
      sandbox=""
      tabIndex={-1}
      sx={[styles.frame, height ? null : styles.sidebarFrame]}
      style={height ? { height } : undefined}
    />
  )
}

/** A hover window opening under the row of `line`, at `column`. */
function Hover({
  on,
  row,
  column,
  above = false,
  children,
}: {
  on: boolean
  row: number
  column: number
  above?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      sx={[styles.hover, above ? styles.above : null, on ? null : styles.off]}
      aria-hidden={!on}
      style={
        {
          "--row": above ? row : row + 1,
          "--column": column,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}

const FILES = ["plan.tsx", "tokens.ts"] as const

/** The editor alone: the file, its hovers and the side bar, for a scene or the banner. */
export function EditorDesk({ feature = "card" }: { feature?: FeatureId }) {
  const list = rows(feature)
  const { card, token } = SAMPLE.anchors
  return (
    <EditorWindow file="plan.tsx" tabs={FILES}>
      <div sx={styles.body}>
        <div sx={styles.codeArea}>
          <Code feature={feature} list={list} />
          <Hover
            on={feature === "card"}
            row={rowOf(list, card.line)}
            column={card.character}
            above
          >
            <Frame
              html={SAMPLE.card}
              kind="hover"
              title="The style card"
              height="17rem"
            />
          </Hover>
          <Hover
            on={feature === "colours"}
            row={rowOf(list, token.line)}
            column={token.character}
          >
            <Frame
              html={SAMPLE.token}
              kind="hover"
              title="A colour token's hover"
              height="6.75rem"
            />
          </Hover>
          <Hover
            on={feature === "lint"}
            row={rowOf(list, SAMPLE.problem.line, true)}
            column={2}
          >
            <div sx={styles.problem}>
              {SAMPLE.problem.message}{" "}
              <span sx={styles.problemCode}>
                {SAMPLE.problem.source}({SAMPLE.problem.code})
              </span>
            </div>
            <div sx={styles.statusBar}>
              <span>View Problem (Alt+F8)</span>
              <span>Quick Fix… (Ctrl+.)</span>
            </div>
          </Hover>
        </div>
        {feature === "inspector" ? (
          <div sx={styles.sidebar}>
            <span sx={styles.sidebarTitle}>Kirana Style Inspector</span>
            <Frame
              html={SAMPLE.inspector}
              kind="view"
              title="The Style Inspector"
            />
          </div>
        ) : null}
      </div>
    </EditorWindow>
  )
}

/** The framed desktop: the editor on a landscape, and a link to the details. */
export function EditorScene({ feature = "card" }: { feature?: FeatureId }) {
  const chosen = FEATURES.find((entry) => entry.id === feature)!
  return (
    <figure sx={styles.figure}>
      <figcaption sx={styles.caption}>
        What Kirana's language server answers for this file, as VS Code shows it
        with the GitHub Dark theme.
      </figcaption>
      <Backdrop
        label={`An editor with Kirana. ${chosen.label}: ${chosen.text}`}
        after={
          <DocsLink href={chosen.href} sx={styles.closer}>
            Take a closer look
            <Icon icon={ArrowUpRight01Icon} size="0.875rem" />
          </DocsLink>
        }
      >
        {/* The editors it runs in are no editor's UI: a grid of them, not a window. */}
        {feature === "editors" ? (
          <EditorsGrid />
        ) : (
          <EditorDesk feature={feature} />
        )}
      </Backdrop>
      <div key={chosen.id} sx={below.description}>
        <span sx={below.title}>{chosen.title}</span>
        <span sx={below.text}>{chosen.text}</span>
      </div>
    </figure>
  )
}

/** The feature list and the scene it drives. */
export function EditorShowcase({ compact = false }: { compact?: boolean }) {
  const [feature, setFeature] = useState<FeatureId>("summary")
  return (
    <div sx={[styles.layout, compact ? styles.layoutCompact : null]}>
      <div
        sx={compact ? styles.optionsChips : styles.options}
        role="group"
        aria-label="Editor features"
      >
        {FEATURES.map((entry) => {
          const on = entry.id === feature
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={on}
              sx={[
                styles.option,
                compact ? styles.optionChip : styles.optionRow,
                on ? styles.optionOn : null,
              ]}
              onMouseEnter={() => setFeature(entry.id)}
              onFocus={() => setFeature(entry.id)}
              onClick={() => setFeature(entry.id)}
            >
              <span sx={[styles.optionIcon, on ? styles.optionIconOn : null]}>
                <Icon icon={entry.icon} size="1.25rem" />
              </span>
              <span sx={styles.optionText}>
                <span sx={styles.optionLabel}>{entry.label}</span>
                {compact ? null : (
                  <span sx={styles.optionTitle}>{entry.title}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <EditorScene feature={feature} />
    </div>
  )
}

export function Editor() {
  return (
    <HomeSection
      number="02"
      eyebrow="In your editor"
      title="Light through every line of your styles."
      lede="A Tailwind class list shows what an element gets; object styles hid it, and that is why teams left CSS-in-JS. Kirana's language server puts it back on every line, coloured by kind, and you keep typed styles, atomic output and a Rust compiler. The build's own compiler answers, so it is never a guess."
    >
      <EditorShowcase />
    </HomeSection>
  )
}
