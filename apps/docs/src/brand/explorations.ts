/**
 * The petal K as a single-colour shape (`currentColor`), for the brand page's surfaces: on light,
 * dark, coloured and gradient grounds, at favicon size and as an app icon. It sits on a 24 × 24 grid
 * of units, 20u tall and centred.
 */

import { MARK, PAINT_ORDER, PARTS, placePath } from "./kirana-mark"

export type Exploration = {
  id: string
  name: string
  /** What the shape means, in a sentence. */
  idea: string
  /** How to rebuild it on the grid. */
  formula: string[]
  /** Filled outlines. */
  fills: string[]
  /** Stroked outlines: width and paths, drawn with round joins. */
  strokes?: { width: number; paths: string[] }
}

const scale = 20 / MARK.height
const place = (d: string) =>
  placePath(d, scale, (24 - MARK.width * scale) / 2, 2)

/** The mark; a hairline stroke on the stem closes the anti-aliased seam where it meets the arm. */
export const PETAL_K: Exploration = {
  id: "petal-k",
  name: "Petal K",
  idea: "A K of three petals (stem, arm and leg), each 5u wide and showing the same area, built from Fibonacci circles on a 16 × 21.5 grid.",
  formula: [
    "Every part 5u wide (F5); the stem rises 2u above the arm's tip; the leg at 36°, the golden triangle's angle",
    "Curves are arcs of 3, 5, 8, 13 and 55u circles, each tangent to the next edge",
    "Full construction: /brand/mark",
  ],
  fills: PAINT_ORDER.map((part) => place(PARTS[part])),
  strokes: { width: 0.2, paths: [place(PARTS.stem)] },
}

/** Surfaces the mark is shown on: solid, gradient and photographic grounds. */
export const SURFACES = [
  { name: "Paper", background: "#fafafa", foreground: "#0a0a0a" },
  { name: "Ink", background: "#0a0a0a", foreground: "#fafafa" },
  { name: "Stone", background: "#e6e4dc", foreground: "#1c1b19" },
  { name: "Navy", background: "#0b3d91", foreground: "#f5efe0" },
  { name: "Crimson", background: "#c70024", foreground: "#ffffff" },
  {
    name: "Dawn",
    background: "linear-gradient(135deg, #fde68a, #f97316 45%, #db2777)",
    foreground: "#ffffff",
  },
  {
    name: "Meadow",
    background: "linear-gradient(135deg, #f5f7c8, #b5e61d 40%, #4cc9f0)",
    foreground: "#0a0a0a",
  },
  {
    name: "Dusk",
    background:
      "radial-gradient(120% 90% at 20% 10%, #7c3aed, #1e1b4b 55%, #020617)",
    foreground: "#ffffff",
  },
  {
    name: "Ember",
    background:
      "radial-gradient(120% 100% at 0% 100%, #ff3b1f, #f97316 35%, #0f766e 80%, #0b0f0e)",
    foreground: "#ffffff",
  },
  {
    name: "Aurora",
    background:
      "radial-gradient(130% 90% at 80% 0%, #a3e635, #0f766e 45%, #042f2e 80%)",
    foreground: "#ffffff",
  },
  {
    name: "Tide",
    background: "linear-gradient(160deg, #1d4ed8, #0ea5e9 55%, #a5f3fc)",
    foreground: "#ffffff",
  },
  {
    name: "Bloom",
    background:
      "radial-gradient(110% 110% at 30% 20%, #f0abfc, #ec4899 40%, #7c3aed 85%)",
    foreground: "#ffffff",
  },
] as const
