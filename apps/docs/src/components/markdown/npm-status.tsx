/**
 * `<!-- ::npm-status -->`: the "not on npm yet" note, from `data/npm-status.ts`. Nothing once the
 * packages are published.
 */
import { Callout } from "@workspace/docs-ui/markdown/callout.tsx"
import {
  MarkdownLink,
  MarkdownParagraph,
} from "@workspace/docs-ui/markdown/index.tsx"

import { PUBLISHED } from "@/data/facts"
import { TARBALLS, npmNote } from "@/data/npm-status"

export function NpmStatus({ kind }: { kind?: string }) {
  if (PUBLISHED) return null
  const note = npmNote(kind)
  return (
    <Callout kind="note" title={note.title}>
      <MarkdownParagraph>
        {note.before}{" "}
        <MarkdownLink href={TARBALLS.href}>{TARBALLS.text}</MarkdownLink>{" "}
        {note.after}
      </MarkdownParagraph>
    </Callout>
  )
}
