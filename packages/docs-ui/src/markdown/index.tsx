import { createContext, use } from "react"
import { css } from "@kirana-style/core"
import type { MarkdownComponents } from "@tanstack/markdown/react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Separator } from "@workspace/ui/components/separator"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accent } from "../accent.ts"
import { useDocs } from "../provider.tsx"
import { Callout } from "./callout.tsx"
import { CodeBlock } from "./code-block.tsx"
import type { CodeBlockProps } from "./code-block.tsx"
import { createCommentComponent } from "./comment-component.tsx"
import type { CommentRegistry } from "./comment-component.tsx"
import { InstallTabs } from "./install-tabs.tsx"
import { MarkdownTabPanel, MarkdownTabs } from "./tabs.tsx"

const styles = {
  h1: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize["4xl"],
    lineHeight: lineHeight["4xl"],
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
    marginBlockEnd: spacing[4],
    scrollMarginBlockStart: spacing[20],
  }),
  h2: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
    marginBlockStart: spacing[12],
    marginBlockEnd: spacing[3],
    scrollMarginBlockStart: spacing[20],
  }),
  h3: css({
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
    marginBlockStart: spacing[8],
    marginBlockEnd: spacing[2],
    scrollMarginBlockStart: spacing[20],
  }),
  h4: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    marginBlockStart: spacing[6],
    marginBlockEnd: spacing[2],
    scrollMarginBlockStart: spacing[20],
  }),
  p: css({
    marginBlockEnd: spacing[4],
    fontSize: fontSize.base,
    lineHeight: "1.75",
    color: theme.foreground,
  }),
  // Dashed underline in the text colour; the section's accent on hover.
  a: css({
    fontWeight: fontWeight.medium,
    color: { base: theme.foreground, ":hover": accent.base },
    textDecorationLine: "underline",
    textDecorationStyle: "dashed",
    textUnderlineOffset: "4px",
    textDecorationColor: { base: alpha.foreground10, ":hover": accent.base },
    transitionProperty: "color, text-decoration-color",
    transitionDuration: "150ms",
  }),
  list: css({
    marginBlockEnd: spacing[4],
    display: "grid",
    // One column that may shrink below its content, so a long item wraps instead of widening
    // the page on a phone.
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: spacing[2],
    paddingInlineStart: spacing[6],
    lineHeight: "1.75",
  }),
  ul: css({ listStyleType: "disc" }),
  ol: css({ listStyleType: "decimal" }),
  li: css({ paddingInlineStart: spacing[1] }),
  code: css({
    borderRadius: radius.sm,
    backgroundColor: alpha.muted50,
    paddingInline: spacing[1],
    paddingBlock: "0.125rem",
    fontFamily: fontFamily.mono,
    fontSize: "0.875em",
    color: theme.foreground,
    // A long string or path breaks rather than pushing a phone's page sideways.
    overflowWrap: "anywhere",
  }),
  codeCell: css({ whiteSpace: "nowrap" }),
  blockquote: css({
    marginBlockEnd: spacing[4],
    borderInlineStartWidth: "2px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: theme.border,
    paddingInlineStart: spacing[4],
    color: theme.mutedForeground,
  }),
  // A logo and its name are one label: "TanStack Start" never breaks under its logo.
  aIcon: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    whiteSpace: "nowrap",
  }),
  // Prose tables wrap: the kit's cells stay on one line, which suits data
  // grids and makes a sentence-long cell scroll the table sideways.
  prose: css({ whiteSpace: "normal", verticalAlign: "top" }),
  cell: css({
    paddingBlock: spacing["2.5"],
    lineHeight: "1.6",
    // Not `anywhere`: that lets the table shrink by breaking inside words ("Turb opac k") where
    // the wrapper should scroll it sideways on a phone.
    overflowWrap: "break-word",
  }),
  table: css({ marginBlockEnd: spacing[6], overflowX: "auto" }),
  separator: css({ marginBlock: spacing[8] }),
  image: css({
    borderRadius: radius.md,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
}

// Written out rather than built from `h${level}`: a tag held in a variable is a
// component to JSX, so `sx` would ride along as an unknown prop and be dropped.
const H1 = (props: React.ComponentProps<"h1">) => (
  <h1 {...props} sx={styles.h1} />
)
const H2 = (props: React.ComponentProps<"h2">) => (
  <h2 {...props} sx={styles.h2} />
)
const H3 = (props: React.ComponentProps<"h3">) => (
  <h3 {...props} sx={styles.h3} />
)
const H4 = (props: React.ComponentProps<"h4">) => (
  <h4 {...props} sx={styles.h4} />
)

/** Set inside table cells, where a link to a page with a logo shows it. */
const InCell = createContext(false)

/**
 * Inline code, highlighted at build time in the language its text looks like. In a table cell it
 * keeps to one line: a name such as `next-webpack` never breaks at its hyphen.
 */
function InlineCode({ html }: { html: string }) {
  return (
    <code
      sx={[styles.code, use(InCell) ? styles.codeCell : null]}
      data-slot="code-inline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function Anchor({ href = "", children, ...props }: React.ComponentProps<"a">) {
  const { Link, pageIcon } = useDocs()
  const icon = use(InCell) ? pageIcon?.(href.split("#")[0]!) : null
  return (
    <Link {...props} href={href} sx={[styles.a, icon ? styles.aIcon : null]}>
      {icon}
      {children}
    </Link>
  )
}

/**
 * What every markdown tag renders as. Keyed by emitted tag name — `a`, not the
 * AST's `link` — plus the `md-*` tags docs-core's build-time extensions emit.
 * `components` adds the app's own comment components to the built-in `install`.
 */
export function createMarkdownComponents(
  components: CommentRegistry = {},
  /** Replaces the code block, to add variants the site draws itself (`editor`). */
  code?: React.ComponentType<CodeBlockProps>
): MarkdownComponents {
  return {
    ...base,
    ...(code ? { "md-code": code } : {}),
    "md-comment-component": createCommentComponent({
      install: InstallTabs as CommentRegistry[string],
      tabs: MarkdownTabs as unknown as CommentRegistry[string],
      ...components,
    }),
  }
}

const base: MarkdownComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  p: (props) => <p {...props} sx={styles.p} />,
  a: Anchor,
  ul: (props) => <ul {...props} sx={[styles.list, styles.ul]} />,
  ol: (props) => <ol {...props} sx={[styles.list, styles.ol]} />,
  li: (props) => <li {...props} sx={styles.li} />,
  code: (props) => <code {...props} sx={styles.code} />,
  "md-inline-code": InlineCode,
  blockquote: (props) => <blockquote {...props} sx={styles.blockquote} />,
  img: (props) => <img {...props} sx={styles.image} />,
  hr: () => <Separator sx={styles.separator} />,
  table: ({ children, ...props }) => (
    <div sx={styles.table}>
      <Table {...props}>{children}</Table>
    </div>
  ),
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: (props) => <TableHead {...props} sx={styles.prose} />,
  td: (props) => (
    <InCell value>
      <TableCell {...props} sx={[styles.prose, styles.cell]} />
    </InCell>
  ),
  "md-code": CodeBlock,
  "md-callout": Callout,
  "md-tab-panel": MarkdownTabPanel,
}
