/**
 * `<!-- ::npm-status -->`: the pre-release install note, from `data/npm-status.ts`. It renders
 * nothing once `PUBLISHED` is true, which it is now; the embed stays so a page can carry it again.
 */
import { Callout } from "@workspace/docs-ui/markdown/callout.tsx"
import {
  MarkdownLink,
  MarkdownParagraph,
} from "@workspace/docs-ui/markdown/index.tsx"

import { PUBLISHED } from "@/data/release"
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
