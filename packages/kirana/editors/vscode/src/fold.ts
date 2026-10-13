/**
 * Style Fold (KRN-DX-015): a long one-line style object, `css({ display: "flex", … })`, reads as its
 * summary — `{ flex · gap 4px · items center }` — until the cursor is on its line, as Tailwind Fold
 * does for class lists. Multi-line objects are folded with the editor's own folding
 * ("Kirana: Fold Styles"). Nothing here imports `vscode`.
 */

export type StyleRange = {
  name: string
  multiline: boolean
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  summary: string
}

/** One object to hide: its range and the text shown in its place. */
export type Folded = {
  line: number
  start: number
  end: number
  label: string
}

/** A one-line object shorter than this stays as written: folding it saves nothing. */
export const MIN_LENGTH = 40

/** The one-line objects to fold: not on a line with a cursor, and long enough to be worth it. */
export function plan(
  ranges: StyleRange[],
  cursorLines: ReadonlySet<number>,
  minLength = MIN_LENGTH
): Folded[] {
  return ranges
    .filter(
      (found) =>
        !found.multiline &&
        found.summary !== "" &&
        !cursorLines.has(found.range.start.line) &&
        found.range.end.character - found.range.start.character >= minLength
    )
    .map((found) => ({
      line: found.range.start.line,
      start: found.range.start.character,
      end: found.range.end.character,
      label: `{ ${found.summary} }`,
    }))
}

/** The lines the editor folds for "Kirana: Fold Styles": each multi-line object's first line. */
export function foldLines(ranges: StyleRange[]): number[] {
  return ranges
    .filter((found) => found.multiline)
    .map((found) => found.range.start.line)
}
