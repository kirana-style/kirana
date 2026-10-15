/**
 * The Kirana logo files, built from the petal K (`kirana-mark.ts`). Every
 * downloadable file, the favicon and the editors' icon come from `toSvg`;
 * nothing is drawn by hand elsewhere.
 *
 * - `mark`: the mark alone, 16 × 21.5 units;
 * - `square`: the mark centred on a 21.5 × 21.5 square, for favicons and the
 *   editors, where icons are square;
 * - `icon`: the mark on a rounded 24u tile, 15u tall, for app icons and
 *   avatars.
 *
 * The brand colours are the Highland morning gradients (`GRADIENTS`): they mark the places that
 * should stand out, such as the favicon, app icons and the editors' icon. The solid colours take
 * one colour for all three parts, as the site's header does.
 */

import { GRADIENTS, MARK, PAINT_ORDER, PARTS } from "./kirana-mark"
import type { Palette, Part } from "./kirana-mark"

/** Neutral colours, as hex so every file works everywhere (the site uses the same values in oklch). */
export const COLOURS = {
  ink: { label: "Ink", hex: "#1a1510", oklch: "oklch(0.2 0.012 70)" },
  paper: { label: "Paper", hex: "#fcfbf8", oklch: "oklch(0.988 0.004 85)" },
} as const

/** The app icon: a 24u tile with corners of 5.5u, the mark 15u tall in its centre. */
export const ICON = { size: 24, radius: 5.5, mark: 15 }

export const LOCKUPS = {
  mark: { label: "Mark", width: MARK.width, height: MARK.height },
  square: { label: "Square", width: MARK.height, height: MARK.height },
  icon: { label: "App icon", width: ICON.size, height: ICON.size },
} as const

export type Lockup = keyof typeof LOCKUPS

/** How the three parts are painted: the brand gradients, or one colour. */
export type Paint = "brand" | "ink" | "paper"

export type Variant = {
  id: string
  label: string
  paint: Paint
  /** The tile's colour, for an icon. */
  backdrop?: string
}

export const VARIANTS: Record<Lockup, Variant[]> = {
  mark: [
    { id: "brand", label: "Brand", paint: "brand" },
    { id: "ink", label: "Ink", paint: "ink" },
    { id: "paper", label: "Paper", paint: "paper" },
  ],
  square: [{ id: "brand", label: "Brand", paint: "brand" }],
  icon: [
    { id: "ink", label: "On ink", paint: "brand", backdrop: COLOURS.ink.hex },
    {
      id: "paper",
      label: "On paper",
      paint: "brand",
      backdrop: COLOURS.paper.hex,
    },
    { id: "mono", label: "Mono", paint: "paper", backdrop: COLOURS.ink.hex },
  ],
}

export function fileName(lockup: Lockup, variant: Variant): string {
  return `kirana-${lockup}-${variant.id}.svg`
}

/** Where the mark sits in a lockup: its scale and offset, in the lockup's units. */
export function placement(lockup: Lockup) {
  if (lockup === "mark") return { scale: 1, x: 0, y: 0 }
  if (lockup === "square")
    return { scale: 1, x: (MARK.height - MARK.width) / 2, y: 0 }
  const scale = ICON.mark / MARK.height
  return {
    scale,
    x: (ICON.size - MARK.width * scale) / 2,
    y: (ICON.size - ICON.mark) / 2,
  }
}

const n = (value: number) => +value.toFixed(4)

/** One linear gradient per part, along the part's vector, in the stops given. */
function gradients(
  id: string,
  stopsOf: (part: Part) => readonly (readonly [number, string])[]
): string {
  return PAINT_ORDER.map((part) => {
    const g = GRADIENTS[part]
    const stops = stopsOf(part)
      .map(
        ([offset, colour]) =>
          `<stop offset="${offset}" stop-color="${colour}"/>`
      )
      .join("")
    return `<linearGradient id="${id}-${part}" gradientUnits="userSpaceOnUse" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${stops}</linearGradient>`
  }).join("")
}

/** True when every stop of every part is one colour: the parts would fuse without a seam. */
export function isOneColour(palette: Palette): boolean {
  return (
    new Set(
      Object.values(palette.stops)
        .flat()
        .map(([, colour]) => colour)
    ).size === 1
  )
}

/**
 * The mark alone in a colour set, with no tile and no background: a file to place on a photo or
 * any ground. Where the three parts share one colour, a mask cuts a transparent seam around the
 * arm (the gap `KiranaMark` paints in the ground's colour), so the K still reads as three petals.
 */
export function markSvg(palette: Palette, id = "kirana"): string {
  const one = isOneColour(palette)
  const colour = palette.stops.stem[0]![1]
  const paint = (part: Part) => (one ? colour : `url(#${id}-${part})`)
  const seam = `<mask id="${id}-seam" maskUnits="userSpaceOnUse" x="-1" y="-1" width="${MARK.width + 2}" height="${MARK.height + 2}"><rect x="-1" y="-1" width="${MARK.width + 2}" height="${MARK.height + 2}" fill="#fff"/><path d="${PARTS.arm}" fill="none" stroke="#000" stroke-width="0.7" stroke-linejoin="round"/></mask>`
  const defs = one ? seam : gradients(id, (part) => palette.stops[part])
  const masked = one ? ` mask="url(#${id}-seam)"` : ""
  const paths = PAINT_ORDER.map((part) =>
    part === "stem"
      ? `<path d="${PARTS[part]}" fill="${paint(part)}" stroke="${paint(part)}" stroke-width="0.2" stroke-linejoin="round"${masked}/>`
      : `<path d="${PARTS[part]}" fill="${paint(part)}"${part === "arm" ? "" : masked}/>`
  ).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK.width} ${MARK.height}" role="img" aria-label="Kirana">${`<defs>${defs}</defs>`}${paths}</svg>\n`
}

/**
 * A standalone SVG file. `id` prefixes the gradients' ids, so several copies
 * inlined in one page each keep their own.
 */
export function toSvg(lockup: Lockup, variant: Variant, id = "kirana"): string {
  const { width, height } = LOCKUPS[lockup]
  const { scale, x, y } = placement(lockup)
  const brand = variant.paint === "brand"
  const paint = (part: string) =>
    variant.paint === "brand"
      ? `url(#${id}-${part})`
      : COLOURS[variant.paint].hex
  const defs = brand
    ? `<defs>${gradients(id, (part) => GRADIENTS[part].stops)}</defs>`
    : ""
  const back = variant.backdrop
    ? `<rect width="${width}" height="${height}" rx="${ICON.radius}" fill="${variant.backdrop}"/>`
    : ""
  // The stem's hairline stroke, in its own paint, runs it under the arm and closes the anti-aliased seam.
  const paths = PAINT_ORDER.map((part) =>
    part === "stem"
      ? `<path d="${PARTS[part]}" fill="${paint(part)}" stroke="${paint(part)}" stroke-width="0.2" stroke-linejoin="round"/>`
      : `<path d="${PARTS[part]}" fill="${paint(part)}"/>`
  ).join("")
  const transform =
    scale === 1 && x === 0 && y === 0
      ? ""
      : ` transform="translate(${n(x)} ${n(y)})${scale === 1 ? "" : ` scale(${n(scale)})`}"`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Kirana">${defs}${back}<g${transform}>${paths}</g></svg>\n`
}
