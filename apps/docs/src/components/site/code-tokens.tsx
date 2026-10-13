/**
 * One-line code in running text or a table cell, coloured like the site's code
 * blocks. Full files are highlighted at build time by docs-core; these are
 * short fragments written in a page's data, so a small tokenizer is enough. It
 * emits the same `th-*` classes, so the colours come from the same theme.
 */
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

const styles = {
  root: css({ fontFamily: fontFamily.mono, overflowWrap: "anywhere" }),
  // The docs' inline code: the same chip, so a page's prose and a doc's read alike.
  inline: css({
    borderRadius: radius.sm,
    backgroundColor: alpha.muted50,
    paddingInline: spacing[1],
    paddingBlock: "0.125rem",
    fontSize: "0.875em",
    color: theme.foreground,
  }),
}

/** Strings, numbers, keys (a name before `:`), calls, and punctuation. */
const JS =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*:)|([A-Za-z_$][\w$]*)(?=\()|([{}[\]():,.=]+)/g

/** Tailwind classes: the variant prefixes are the part worth seeing. */
const CLASSES = /([\w-]+(?:-\[[^\]]*\])?:)|(\([^)]*\))/g

function tokens(source: string, pattern: RegExp, kinds: readonly string[]) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) out.push(source.slice(last, index))
    const group = match.slice(1).findIndex((value) => value !== undefined)
    out.push(
      <span key={index} className={`th-token th-${kinds[group]}`}>
        {match[0]}
      </span>
    )
    last = index + match[0].length
  }
  if (last < source.length) out.push(source.slice(last))
  return out
}

export function CodeTokens({
  children,
  lang = "js",
  sx,
}: {
  children: string
  /** `js` for objects and calls, `classes` for a Tailwind class string. */
  lang?: "js" | "classes"
  sx?: Sx
}) {
  return (
    <code sx={[styles.root, sx]} data-slot="code-block-source">
      {lang === "js"
        ? tokens(children, JS, [
            "string",
            "number",
            "property",
            "function",
            "operator",
          ])
        : tokens(children, CLASSES, ["keyword", "function"])}
    </code>
  )
}

/** Code in a sentence on a site page, drawn as the docs draw inline code. */
export function InlineCode({ children }: { children: string }) {
  return <CodeTokens sx={styles.inline}>{children}</CodeTokens>
}
