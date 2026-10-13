/**
 * "In your editor": what Kirana's extension shows, as a desktop you can look around.
 * A feature list on the left, picked by hovering it; on the right a framed scene — a dark
 * editor window, its open files as tabs, a component with its summaries at the end of the
 * lines, and a hover window over it that fades to the feature picked: the style card, the
 * inspector, Style Fold, the colour picker, a diagnostic with its fix, and the editors it
 * runs in. What the scene is drawn from sits above it; what the feature does, below.
 *
 * The editor and its hovers are dark in both schemes, as a dark editor's are. Everything
 * shown is something the extension draws (`/docs/tooling/editor`).
 */
import { useState } from "react"
import { css, keyframes } from "@kirana-style/core"
import {
  Alert02Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  ColorsIcon,
  CursorMagicSelection02Icon,
  LayoutRightIcon,
  TextFontIcon,
  ViewOffSlashIcon,
  VisualStudioCodeIcon,
} from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { DocsLink } from "@/components/docs-link"
import { EDITOR, EditorWindow, Hint } from "@/components/site/editor-window"
import { SVGL } from "@/generated/svgl-icons.gen"

import { HomeSection } from "./frame"

/** GitHub's dark theme, the one the docs' code blocks use in dark mode. */
const SYNTAX = {
  keyword: css({ color: "#ff7b72" }),
  string: css({ color: "#a5d6ff" }),
  fn: css({ color: "#d2a8ff" }),
  property: css({ color: "#79c0ff" }),
  tag: css({ color: "#7ee787" }),
}

const DANGER =
  "light-dark(oklch(0.577 0.245 27.325), oklch(0.704 0.191 22.216))"

/** A window that floats over the editor, in the page's colours. */
const FLOAT =
  "0 0 0 1px rgb(0 0 0 / 0.04), 0 2px 6px rgb(0 0 0 / 0.08), 0 24px 48px -18px rgb(0 0 0 / 0.35)"

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

  // The feature list: quiet rows, the chosen one lifted onto a card.
  options: css({ display: "grid", gap: spacing["1.5"], alignContent: "start" }),
  option: css({
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: spacing[4],
    paddingInline: spacing[5],
    paddingBlock: spacing[4],
    borderRadius: "1.125rem",
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
  optionIcon: css({ marginBlockStart: "2px", color: theme.mutedForeground }),
  optionIconOn: css({ color: accent.base }),
  optionText: css({ display: "grid", gap: spacing[1] }),
  optionLabel: css({
    fontSize: "0.6875rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wider,
    textTransform: "uppercase",
  }),
  optionTitle: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),

  // The scene: a soft sky in the site's colours, a desktop on it.
  figure: css({ margin: 0, minWidth: 0 }),
  stage: css({
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: { base: "1.25rem", [breakpoint.md]: "1.75rem" },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    paddingInline: { base: spacing[3], [breakpoint.md]: "7%" },
    paddingBlockStart: { base: spacing[4], [breakpoint.md]: "7%" },
    paddingBlockEnd: { base: spacing[16], [breakpoint.md]: "14%" },
    backgroundColor: "light-dark(#eef2f8, #0f1116)",
    backgroundImage: [
      "radial-gradient(120% 90% at 0% 0%, light-dark(oklch(0.9 0.06 235), oklch(0.32 0.09 250)), transparent 62%)",
      "radial-gradient(90% 80% at 100% 100%, light-dark(oklch(0.91 0.07 300), oklch(0.3 0.1 300)), transparent 60%)",
      "radial-gradient(60% 55% at 85% 8%, light-dark(oklch(0.95 0.06 75), oklch(0.3 0.06 60)), transparent 62%)",
    ].join(", "),
  }),
  // The desktop: the editor, with a second window over its lower right.
  desk: css({ position: "relative" }),
  body: css({
    display: "flex",
    minHeight: { base: "auto", [breakpoint.md]: "23rem" },
  }),
  code: css({
    flex: 1,
    minWidth: 0,
    margin: 0,
    paddingBlock: spacing[3],
    overflowX: "auto",
    fontFamily: fontFamily.mono,
    fontSize: { base: "0.6875rem", [breakpoint.md]: "0.78rem" },
    lineHeight: "1.8",
    color: "#e6edf3",
    scrollbarWidth: "none",
  }),
  line: css({
    display: "flex",
    alignItems: "center",
    minWidth: "max-content",
    paddingInlineEnd: spacing[4],
    whiteSpace: "pre",
  }),
  // Inline, so the line keeps its spaces: a flex row drops whitespace-only text.
  text: css({ whiteSpace: "pre" }),
  current: css({ backgroundColor: EDITOR.current }),
  number: css({
    flexShrink: 0,
    width: "2.75rem",
    paddingInlineEnd: spacing[4],
    textAlign: "end",
    color: EDITOR.gutter,
    userSelect: "none",
  }),
  lens: css({
    display: "block",
    paddingInlineStart: "2.75rem",
    fontSize: "0.85em",
    color: EDITOR.muted,
    whiteSpace: "pre",
  }),
  swatch: css({
    display: "inline-block",
    width: "0.8em",
    height: "0.8em",
    marginInlineEnd: "0.4em",
    verticalAlign: "-0.05em",
    borderRadius: "2px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgb(255 255 255 / 0.3)",
    backgroundColor: "#0af",
  }),
  swatchOn: css({
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "#8fb4ff",
    outlineOffset: "1px",
  }),
  squiggle: css({
    textDecorationLine: "underline",
    textDecorationStyle: "wavy",
    textDecorationColor: "#ff7b72",
    textUnderlineOffset: "4px",
  }),
  folded: css({
    marginInlineStart: 0,
    outlineWidth: "1px",
    outlineStyle: "dashed",
    outlineColor: "rgb(143 180 255 / 0.45)",
  }),
  lit: css({
    boxShadow:
      "0 0 0 1px rgb(143 180 255 / 0.55), 0 0 18px rgb(143 180 255 / 0.25)",
  }),

  // A hover window over the editor, dark as the editor's own: `color-scheme` takes every
  // token inside it to its dark side. Each feature has one; they fade into each other.
  float: css({
    colorScheme: "dark",
    transitionProperty: "opacity, translate",
    transitionDuration: {
      base: "220ms",
      "@media (prefers-reduced-motion: reduce)": "0s",
    },
    transitionTimingFunction: "ease-out",
    position: { base: "relative", [breakpoint.md]: "absolute" },
    insetInlineEnd: { base: "auto", [breakpoint.md]: "-5%" },
    insetBlockStart: { base: "auto", [breakpoint.md]: "38%" },
    zIndex: 2,
    width: { base: "auto", [breakpoint.md]: "min(27rem, 68%)" },
    marginBlockStart: { base: spacing[3], [breakpoint.md]: 0 },
    overflow: "hidden",
    borderRadius: "0.875rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgb(255 255 255 / 0.12)",
    backgroundColor: "#24262c",
    color: EDITOR.text,
    boxShadow: FLOAT,
    fontSize: fontSize.xs,
    lineHeight: "1.6",
  }),
  // The hidden ones: faded and out of the way on wide screens, not drawn on narrow ones,
  // where the window sits under the editor instead of over it.
  floatOff: css({
    display: { base: "none", [breakpoint.md]: "block" },
    opacity: 0,
    translate: "0 8px",
    pointerEvents: "none",
  }),
  floatBar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing["3.5"],
    paddingBlock: spacing[2],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    backgroundColor: tint(6),
    fontWeight: fontWeight.semibold,
  }),
  mark: css({ height: "0.95rem" }),
  floatNote: css({
    marginInlineStart: "auto",
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  floatBody: css({ display: "grid", gap: spacing[3], padding: spacing["3.5"] }),
  split: css({
    display: "grid",
    gap: spacing[3],
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "start",
  }),
  // The box model, drawn as DevTools draws it.
  box: css({
    display: "grid",
    justifyItems: "center",
    paddingInline: spacing["1.5"],
    paddingBlock: "2px",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderRadius: radius.sm,
    fontFamily: fontFamily.mono,
    fontSize: "0.625rem",
  }),
  margin: css({ borderColor: tint(35) }),
  border: css({ borderStyle: "solid", borderColor: theme.foreground }),
  padding: css({ borderColor: tint(55), backgroundColor: tint(8) }),
  content: css({
    paddingInline: spacing["2.5"],
    paddingBlock: "3px",
    marginBlock: "2px",
    borderRadius: "2px",
    backgroundColor: tint(18),
    whiteSpace: "nowrap",
  }),
  boxLabel: css({ justifySelf: "start", color: theme.mutedForeground }),
  table: css({
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    columnGap: spacing[3],
    rowGap: "2px",
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    whiteSpace: "nowrap",
  }),
  muted: css({ color: theme.mutedForeground }),
  rule: css({
    margin: 0,
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    borderRadius: radius.md,
    backgroundColor: theme.muted,
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    whiteSpace: "pre",
    overflowX: "auto",
  }),
  chips: css({ display: "flex", flexWrap: "wrap", gap: spacing["1.5"] }),
  chip: css({
    display: "inline-flex",
    alignItems: "center",
    paddingInline: spacing["2.5"],
    paddingBlock: "2px",
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    color: theme.mutedForeground,
  }),
  chipOn: css({
    borderColor: accent.base,
    backgroundColor: tint(12),
    color: theme.foreground,
  }),
  picker: css({
    position: "relative",
    height: "6.5rem",
    borderRadius: radius.md,
    backgroundImage:
      "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, oklch(0.72 0.15 230))",
  }),
  pickerDot: css({
    position: "absolute",
    insetInlineStart: "72%",
    insetBlockStart: "28%",
    width: "12px",
    height: "12px",
    borderRadius: radius.full,
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "white",
    boxShadow: "0 0 0 1px rgb(0 0 0 / 0.3)",
  }),
  hue: css({
    height: "8px",
    borderRadius: radius.full,
    backgroundImage:
      "linear-gradient(to right, oklch(0.7 0.15 0), oklch(0.7 0.15 90), oklch(0.7 0.15 180), oklch(0.7 0.15 270), oklch(0.7 0.15 360))",
  }),
  modes: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: spacing[2],
  }),
  mode: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing[2],
    paddingBlock: spacing["1.5"],
    borderRadius: radius.md,
    backgroundColor: theme.muted,
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
  }),
  modeSwatch: css({
    flexShrink: 0,
    width: "14px",
    height: "14px",
    borderRadius: "3px",
  }),
  danger: css({ color: DANGER, fontWeight: fontWeight.semibold }),
  fix: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    borderRadius: radius.md,
    backgroundColor: tint(10),
  }),
  editors: css({ display: "grid", gap: spacing[1] }),
  editorRow: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["2.5"],
    paddingBlock: spacing[1],
  }),
  editorNote: css({
    marginInlineStart: "auto",
    color: theme.mutedForeground,
  }),
  ok: css({
    display: "inline-flex",
    color: "light-dark(oklch(0.596 0.145 163.225), oklch(0.765 0.177 163.223))",
  }),

  closer: css({
    position: "absolute",
    insetInlineEnd: spacing[4],
    insetBlockEnd: spacing[4],
    zIndex: 3,
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing["3.5"],
    paddingBlock: spacing[2],
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor:
      "light-dark(rgb(255 255 255 / 0.85), rgb(20 22 28 / 0.85))",
    backdropFilter: "blur(12px)",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
    textDecorationLine: "none",
  }),
  caption: css({
    marginBlockEnd: spacing[3],
    textAlign: "center",
    fontSize: fontSize.xs,
    lineHeight: "1.6",
    color: theme.mutedForeground,
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
    text: "What the element ends up with, in a class list's words and coloured by kind — layout, box, size, colour, type, border. Guards lead their values.",
    href: "/docs/tooling/editor#inline-summary",
  },
  {
    id: "card",
    icon: CursorMagicSelection02Icon,
    label: "Style card",
    title: "Hover for the whole story.",
    text: "The box model as DevTools draws it, every declaration with rem in pixels and the token it reads, and the compiled rules.",
    href: "/docs/tooling/editor#the-style-card",
  },
  {
    id: "inspector",
    icon: LayoutRightIcon,
    label: "Style Inspector",
    title: "Turn :hover and md on.",
    text: "A panel that follows the cursor. Toggle a condition or a guard and it shows what applies then — the compiler's answer, not a guess.",
    href: "/docs/tooling/editor#style-inspector-vs-code",
  },
  {
    id: "fold",
    icon: ViewOffSlashIcon,
    label: "Style Fold",
    title: "Long objects, read short.",
    text: "A style object folds into its summary until the cursor reaches it — Tailwind Fold, for objects.",
    href: "/docs/tooling/editor#style-fold-vs-code",
  },
  {
    id: "colours",
    icon: ColorsIcon,
    label: "Colours",
    title: "Both sides of light-dark().",
    text: "A swatch per mode, and a picker that keeps oklch() as oklch() — on literals, never on a token.",
    href: "/docs/tooling/editor#colours",
  },
  {
    id: "lint",
    icon: Alert02Icon,
    label: "Diagnostics",
    title: "Wrong styles, caught as you type.",
    // consistency: subset — Biome cannot run the compiler's diagnostics
    text: "The compiler's own diagnostics at the property, with a fix one keystroke away — the same under Oxlint and ESLint.",
    href: "/docs/tooling/diagnostics",
  },
  {
    id: "editors",
    icon: VisualStudioCodeIcon,
    label: "Everywhere",
    title: "Your editor, your framework.",
    text: "VS Code and its forks, Zed, Neovim and Helix, in .tsx, .vue, .svelte and .astro — running your project's own engine.",
    href: "/docs/tooling/editor#pick-your-editor",
  },
]

const k = (text: string) => <span sx={SYNTAX.keyword}>{text}</span>
const s = (text: string) => <span sx={SYNTAX.string}>{text}</span>
const f = (text: string) => <span sx={SYNTAX.fn}>{text}</span>
const p = (text: string) => <span sx={SYNTAX.property}>{text}</span>
const t = (text: string) => <span sx={SYNTAX.tag}>{text}</span>

const CARD_HINT = "▦ grid · gap 1rem · p 1rem · +2"
/** The same summary unshortened: a folded object has the whole line. */
const CARD_FOLDED = "▦ grid · gap 1rem · p 1rem · border #0af · md: p 1.5rem"
const TITLE_HINT = "text 1.25rem · 600 · ink"

function Line({
  n,
  current,
  children,
}: {
  n: number
  current?: boolean
  children?: React.ReactNode
}) {
  return (
    <span sx={[styles.line, current ? styles.current : null]}>
      <span sx={styles.number}>{n}</span>
      <span sx={styles.text}>{children ?? " "}</span>
    </span>
  )
}

/** The component in the editor, drawn for the chosen feature. */
function Code({ feature }: { feature: FeatureId }) {
  const fold = feature === "fold"
  const lint = feature === "lint"
  // Lines after the style object move with it: folded, or one longer for the error.
  const after = (n: number) => (fold ? n - 4 : lint ? n + 1 : n)
  return (
    <pre sx={styles.code}>
      <code>
        <Line n={1}>
          {k("import")} {"{ "}
          {f("css")}
          {" }"} {k("from")} {s('"@kirana-style/core"')}
        </Line>
        <Line n={2}>
          {k("import")} {"{ color, space }"} {k("from")} {s('"./tokens"')}
        </Line>
        <Line n={3} />
        {fold ? (
          <Line n={4} current>
            {k("const")} card = <Hint text={CARD_FOLDED} sx={styles.folded} />
          </Line>
        ) : (
          <>
            <span sx={styles.lens}>
              css() · 5 declarations · used by 2 elements
            </span>
            <Line n={4}>
              {k("const")} card = {f("css")}({"{"}
            </Line>
            <Line n={5}>
              {"  "}
              {p("display")}: {s('"grid"')}, {p("gap")}: space[{p("4")}],
            </Line>
            <Line n={6}>
              {"  "}
              {p("padding")}: {"{ "}
              {p("base")}: space[{p("4")}], [md]: space[{p("6")}] {"}"},
            </Line>
            <Line n={7} current={feature === "colours"}>
              {"  "}
              {p("borderColor")}:{" "}
              <span
                sx={[
                  styles.swatch,
                  feature === "colours" ? styles.swatchOn : null,
                ]}
              />
              color.{p("brand")},
            </Line>
            {lint ? (
              <Line n={8} current>
                {"  "}
                <span sx={styles.squiggle}>
                  {p("width")}: {p("5")}
                </span>
                ,
              </Line>
            ) : null}
            <Line n={after(8)}>{"})"}</Line>
          </>
        )}
        <Line n={after(9)} />
        <Line n={after(10)}>
          {k("export const")} {f("Plan")} = () {k("=>")} (
        </Line>
        <Line n={after(11)} current={feature === "card"}>
          {"  <"}
          {t("article")} {p("sx")}={"{"}card{"}"}
          {">"}
          {fold ? null : (
            <Hint
              text={CARD_HINT}
              sx={
                feature === "summary" || feature === "card" ? styles.lit : null
              }
            />
          )}
        </Line>
        <Line n={after(12)}>
          {"    <"}
          {t("h2")} {p("sx")}={"{"}title{"}"}
          {">"}Pro{"</"}
          {t("h2")}
          {">"}
          <Hint
            text={TITLE_HINT}
            sx={feature === "summary" ? styles.lit : null}
          />
        </Line>
        <Line n={after(13)}>
          {"  </"}
          {t("article")}
          {">"}
        </Line>
        <Line n={after(14)}>{")"}</Line>
      </code>
    </pre>
  )
}

/** A floating window's title bar, led by Kirana's mark. */
function FloatBar({ title, note }: { title: string; note?: string }) {
  return (
    <div sx={styles.floatBar}>
      <KiranaMark title={null} sx={styles.mark} />
      {title}
      {note ? <span sx={styles.floatNote}>{note}</span> : null}
    </div>
  )
}

function BoxModel({ padding = "16" }: { padding?: string }) {
  return (
    <div sx={[styles.box, styles.margin]}>
      <span sx={styles.boxLabel}>margin</span>
      <div sx={[styles.box, styles.border]}>
        <span sx={styles.boxLabel}>border 1</span>
        <div sx={[styles.box, styles.padding]}>
          <span sx={styles.boxLabel}>padding {padding}</span>
          <span sx={styles.content}>grid · gap 16</span>
        </div>
      </div>
    </div>
  )
}

/** The group colours on the page, for windows over the editor. */
const PAGE_GROUP = {
  layout: css({
    color: "light-dark(oklch(0.52 0.17 255), oklch(0.75 0.13 255))",
  }),
  box: css({
    color: "light-dark(oklch(0.52 0.14 150), oklch(0.78 0.15 150))",
  }),
  border: css({
    color: "light-dark(oklch(0.52 0.17 305), oklch(0.76 0.13 305))",
  }),
}

/** Property names in their group's colour, as the card prints them. */
const DECLARATIONS: readonly [keyof typeof PAGE_GROUP, string, string][] = [
  ["layout", "display", "grid"],
  ["layout", "gap", "1rem · 16px"],
  ["box", "padding", "1rem · md: 1.5rem"],
  ["border", "border-color", "#0af · color.brand"],
]

function Declarations({ md }: { md?: boolean }) {
  return (
    <div sx={styles.table}>
      {DECLARATIONS.flatMap(([group, property, value]) => [
        <span key={`${property}-name`} sx={PAGE_GROUP[group]}>
          {property}
        </span>,
        <span key={`${property}-value`}>
          {md && property === "padding" ? "1.5rem · 24px" : value}
        </span>,
      ])}
    </div>
  )
}

const EDITORS = [
  [SVGL.vscode, "VS Code", "extension"],
  [SVGL.cursor, "Cursor", "extension"],
  [SVGL.zed, "Zed", "extension"],
  [SVGL.neovim, "Neovim", "vim.lsp.config"],
] as const

/** The hover window for each feature, shown when it is the chosen one; the summary has none. */
function Overlay({ feature, on }: { feature: FeatureId; on: boolean }) {
  const float = [styles.float, on ? null : styles.floatOff]
  switch (feature) {
    case "card":
      return (
        <div sx={float} aria-hidden={!on}>
          {/* consistency: ignore — the code lens counts CSS rules, not lint rules */}
          <FloatBar title="card" note="css() · 6 rules" />
          <div sx={styles.floatBody}>
            <div sx={styles.split}>
              <BoxModel />
              <Declarations />
            </div>
            <pre sx={styles.rule}>
              {
                ".k5O_fqMV { display: grid }\n.kJ_pnCg { gap: 1rem }\n@media (width >= 48rem) {\n  .k0-x8Qe_kf2c { padding: 1.5rem }\n}"
              }
            </pre>
          </div>
        </div>
      )
    case "inspector":
      return (
        <div sx={float} aria-hidden={!on}>
          <FloatBar title="Style Inspector" note="<article>" />
          <div sx={styles.floatBody}>
            <div sx={styles.chips}>
              <span sx={styles.chip}>:hover</span>
              <span sx={[styles.chip, styles.chipOn]}>md</span>
              <span sx={styles.chip}>:focus-visible</span>
            </div>
            <div sx={styles.split}>
              <BoxModel padding="24" />
              <Declarations md />
            </div>
          </div>
        </div>
      )
    case "fold":
      return (
        <div sx={float} aria-hidden={!on}>
          <FloatBar title="Style Fold" note="kirana.fold" />
          <div sx={styles.floatBody}>
            <div sx={styles.table}>
              <span sx={styles.muted}>mode</span>
              <span>fold · dim</span>
              <span sx={styles.muted}>minLength</span>
              <span>40</span>
              <span sx={styles.muted}>icon</span>
              <span>on</span>
            </div>
            <span sx={styles.muted}>
              The object reads as its summary until the cursor reaches its line.
            </span>
          </div>
        </div>
      )
    case "colours":
      return (
        <div sx={float} aria-hidden={!on}>
          <FloatBar title="light-dark()" note="oklch()" />
          <div sx={styles.floatBody}>
            <div sx={styles.picker}>
              <span sx={styles.pickerDot} />
            </div>
            <div sx={styles.hue} />
            <div sx={styles.modes}>
              <span sx={styles.mode}>
                <span
                  sx={styles.modeSwatch}
                  style={{ backgroundColor: "oklch(0.62 0.15 230)" }}
                />
                light
              </span>
              <span sx={styles.mode}>
                <span
                  sx={styles.modeSwatch}
                  style={{ backgroundColor: "oklch(0.78 0.12 230)" }}
                />
                dark
              </span>
            </div>
          </div>
        </div>
      )
    case "lint":
      return (
        <div sx={float} aria-hidden={!on}>
          <FloatBar title="kirana" note="KRN1203" />
          <div sx={styles.floatBody}>
            <span>
              <span sx={styles.danger}>unitless-length</span> width does not
              accept a bare number (5)
            </span>
            <span sx={styles.fix}>
              <Icon icon={CheckmarkCircle02Icon} size="0.875rem" />
              Quick fix: write "5px"
            </span>
          </div>
        </div>
      )
    case "editors":
      return (
        <div sx={float} aria-hidden={!on}>
          <FloatBar title="Kirana" note="kirana lsp" />
          <div sx={styles.floatBody}>
            <div sx={styles.editors}>
              {EDITORS.map(([icon, name, note]) => (
                <span key={name} sx={styles.editorRow}>
                  <BrandIcon icon={icon} size="1rem" />
                  {name}
                  <span sx={styles.editorNote}>{note}</span>
                  <span sx={styles.ok}>
                    <Icon icon={CheckmarkCircle02Icon} size="0.875rem" />
                  </span>
                </span>
              ))}
            </div>
            <div sx={styles.chips}>
              {[".tsx", ".vue", ".svelte", ".astro"].map((extension) => (
                <span key={extension} sx={styles.chip}>
                  {extension}
                </span>
              ))}
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}

const FILES = ["Plan.tsx", "tokens.ts", "Card.vue", "Card.svelte"] as const

/** The framed desktop: the editor, the window over it, and a link to the details. */
export function EditorScene({ feature = "card" }: { feature?: FeatureId }) {
  const chosen = FEATURES.find((entry) => entry.id === feature)!
  return (
    <figure sx={styles.figure}>
      <figcaption sx={styles.caption}>
        Drawn from what the VS Code extension shows in a dark theme. Every LSP
        editor gets the summaries, the card and the fixes.
      </figcaption>
      <div
        sx={styles.stage}
        role="img"
        aria-label={`An editor with Kirana — ${chosen.label}: ${chosen.text}`}
      >
        <div sx={styles.desk}>
          <EditorWindow file="Plan.tsx" tabs={FILES}>
            <div sx={styles.body}>
              <Code feature={feature} />
            </div>
          </EditorWindow>
          {FEATURES.map((entry) => (
            <Overlay
              key={entry.id}
              feature={entry.id}
              on={entry.id === feature}
            />
          ))}
        </div>
        <DocsLink href={chosen.href} sx={styles.closer}>
          Take a closer look
          <Icon icon={ArrowUpRight01Icon} size="0.875rem" />
        </DocsLink>
      </div>
      <div key={chosen.id} sx={below.description}>
        <span sx={below.title}>{chosen.title}</span>
        <span sx={below.text}>{chosen.text}</span>
      </div>
    </figure>
  )
}

/** The feature list and the scene it drives. */
export function EditorShowcase() {
  const [feature, setFeature] = useState<FeatureId>("summary")
  return (
    <div sx={styles.layout}>
      <div sx={styles.options} role="group" aria-label="Editor features">
        {FEATURES.map((entry) => {
          const on = entry.id === feature
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={on}
              sx={[styles.option, on ? styles.optionOn : null]}
              onMouseEnter={() => setFeature(entry.id)}
              onFocus={() => setFeature(entry.id)}
              onClick={() => setFeature(entry.id)}
            >
              <span sx={[styles.optionIcon, on ? styles.optionIconOn : null]}>
                <Icon icon={entry.icon} size="1.25rem" />
              </span>
              <span sx={styles.optionText}>
                <span sx={styles.optionLabel}>{entry.label}</span>
                <span sx={styles.optionTitle}>{entry.title}</span>
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
      accent="sky"
      icon={VisualStudioCodeIcon}
      eyebrow="In your editor"
      title="Light through every line of your styles."
      lede="A Tailwind class list shows what an element gets; object styles hid it, and that is why teams left CSS-in-JS. Kirana's language server puts it back on every line, coloured by kind — and you keep typed styles, atomic output and a Rust compiler. The build's own compiler answers, so it is never a guess."
    >
      <EditorShowcase />
    </HomeSection>
  )
}
