/**
 * The tools the benchmarks compare, as chart series: a key a custom property can carry
 * (`stylex-swc`), and two colourings. The bars, each labelled, highlight Kirana in the accent
 * against a wash of it. The lines need every tool told apart, so each takes its logo's colour,
 * softened so Kirana's line in the accent reads first.
 */
import { accent, tint } from "@workspace/docs-ui/accent.ts"
import type { ChartConfig } from "@workspace/ui/components/chart"

import { TOOLS } from "@/data/benchmarks"
import type { Tool } from "@/data/benchmarks"

export const toolKey = (tool: Tool) =>
  tool.toLowerCase().replace(/\W+/g, "-").replace(/-$/, "")

/** StyleX, StyleX (SWC) and Tailwind, in `TOOLS` order after Kirana. */
const LOGOS = [
  "light-dark(oklch(0.55 0.22 330), oklch(0.74 0.18 330))",
  "light-dark(oklch(0.58 0.17 305), oklch(0.77 0.13 305))",
  "light-dark(oklch(0.6 0.13 232), oklch(0.79 0.12 228))",
]

const configOf = (color: (tool: Tool, index: number) => string): ChartConfig =>
  Object.fromEntries(
    TOOLS.map((tool, index) => [
      toolKey(tool),
      { label: tool, color: color(tool, index) },
    ])
  )

export const highlightConfig = configOf((tool) =>
  tool === "Kirana" ? accent.base : tint(35)
)

export const distinctConfig = configOf((tool, index) =>
  tool === "Kirana"
    ? accent.base
    : `color-mix(in oklab, ${LOGOS[(index - 1) % LOGOS.length]!} 62%, transparent)`
)

/** The color scale for a definition: each tool's key to its `--color-<key>`. */
export const toolColors = {
  domain: TOOLS.map(toolKey),
  range: TOOLS.map((tool) => `var(--color-${toolKey(tool)})`),
}
