/**
 * Coloured summaries (KRN-DX-013): the hint after an element, coloured by group as the card colours
 * its properties, in the editors' palette (`editors/brand/palette.json`).
 *
 * VS Code draws an inlay hint in one colour, and it does not promise an order for several
 * decorations at one position. So the whole summary is one piece of text, coloured by a gradient
 * with a hard stop at each part's edge, measured in `ch` (the editor's font is monospaced; the
 * separators are one character wide). Nothing here imports `vscode`.
 */

import { GROUP_COLOURS, HINT_QUIET } from "./brand.ts"

/** One part of a summary; the server sends its group's colour with it. */
export type Part = { text: string; group: string; colour?: string }

/** What the server's inlay hint carries for a client to colour. */
export type HintData = {
  uri: string
  start: number
  end: number
  mark: string
  parts: Part[]
}

export const SEPARATOR = " · "

/** Code points, as `ch` counts them. */
const width = (text: string) => Array.from(text).length

/** A part's colour: the one the server sent, else the palette's, else the hint's own. */
export const partColour = (part: Part) =>
  part.colour ?? GROUP_COLOURS[part.group] ?? HINT_QUIET

/** The summary's text and the CSS that colours it, at `opacity` (Tailwind Fold's dimming). */
export function colour(
  parts: Part[],
  opacity = 1
): { text: string; css: string } {
  const stops: string[] = []
  let at = 0
  const stop = (paint: string, length: number) => {
    stops.push(`${paint} ${at}ch ${at + length}ch`)
    at += length
  }
  parts.forEach((part, index) => {
    if (index > 0) stop(HINT_QUIET, width(SEPARATOR))
    stop(
      part.group === "more" ? HINT_QUIET : partColour(part),
      width(part.text)
    )
  })
  const text = parts.map((part) => part.text).join(SEPARATOR)
  // Carried in `textDecoration`, the only attachment property VS Code passes through as CSS.
  const css = [
    "none",
    `background-image: linear-gradient(90deg, ${stops.join(", ")})`,
    "-webkit-background-clip: text",
    "background-clip: text",
    "-webkit-text-fill-color: transparent",
    `opacity: ${opacity}`,
  ].join("; ")
  return { text, css }
}

/** The summary on a line, when the position is at or past it: the hover over a coloured summary. */
export function hintAt<
  Hint extends { position: { line: number; character: number } },
>(hints: readonly Hint[], line: number, character: number): Hint | undefined {
  return hints.find(
    (hint) =>
      hint.position.line === line && character >= hint.position.character
  )
}
