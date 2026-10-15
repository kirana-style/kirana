/**
 * The site's benchmark figures, copied from
 * `packages/kirana/design-notes/benchmark-results.md`, "Full three-way corpus (sprint 2)": the
 * median of five interleaved `vite build` runs of the same three applications
 * built with Kirana, the StyleX port and the Tailwind original, on one
 * developer machine. Advisory, as that file says — not a published claim.
 *
 * Update both together: the numbers here are the ones in that table.
 */
/** Where the numbers live in the repository; the pages link it on GitHub. */
export const BENCH_SOURCE = "packages/kirana/design-notes/benchmark-results.md"

/**
 * The private runtime's cap, minified and gzipped: KRN-DYN-005 holds it under 1,000 bytes, and
 * `npm/core/test/internal.test.ts` asserts it (design-notes/runtime-merge.md). Prose says "under
 * {{fact:runtime-size}}"; a component reads this.
 */
export const RUNTIME_SIZE = "1 kB"

export type Tool = "Kirana" | "StyleX" | "Tailwind"

export const TOOLS: readonly Tool[] = ["Kirana", "StyleX", "Tailwind"]

export const APPS = ["web", "blocks", "examples"] as const

export type Metric = {
  id: string
  label: string
  unit: string
  /** One value per app, in `APPS` order. */
  values: Record<Tool, readonly [number, number, number]>
  /** The corpus total, from the same section's second table. */
  total: Record<Tool, number>
  /** Lower is better for every metric here. */
  note: string
}

export const METRICS: readonly Metric[] = [
  {
    id: "build",
    label: "Build time",
    unit: "s",
    values: {
      Kirana: [1.43, 2.18, 1.94],
      StyleX: [3.26, 7.46, 5.51],
      Tailwind: [1.56, 1.97, 1.86],
    },
    total: { Kirana: 5.55, StyleX: 16.23, Tailwind: 5.39 },
    note: "2.9× faster than StyleX; within 3 % of Tailwind, which wins on two of the three apps.",
  },
  {
    id: "css",
    label: "CSS, gzip",
    unit: "kB",
    values: {
      Kirana: [17.6, 21.2, 22.1],
      StyleX: [17.8, 22.2, 22.9],
      Tailwind: [26.9, 30.4, 29.7],
    },
    total: { Kirana: 60.9, StyleX: 63.0, Tailwind: 87.1 },
    note: "The smallest gzipped CSS of the three. Raw, StyleX's is 23.3 kB smaller.",
  },
  {
    id: "total",
    label: "CSS + JS, gzip",
    unit: "kB",
    values: {
      Kirana: [293.2, 660.2, 647.7],
      StyleX: [300.3, 685.6, 673.1],
      Tailwind: [306.9, 676.6, 655.7],
    },
    total: { Kirana: 1601.1, StyleX: 1659.0, Tailwind: 1639.1 },
    note: "57.9 kB less than StyleX and 38.0 kB less than Tailwind over the three apps.",
  },
]

const total = (id: string, tool: Tool) =>
  METRICS.find((metric) => metric.id === id)!.total[tool]

/**
 * The figures the homepage leads with. Each is from a section of `BENCH_SOURCE` (or the design note
 * named), measured on one developer machine: advisory, like every number in that file.
 */
export const HEADLINES: readonly {
  id: string
  value: string
  label: string
  /** Where in the repository the number comes from. */
  source: string
}[] = [
  {
    id: "build",
    value: `${(total("build", "StyleX") / total("build", "Kirana")).toFixed(1)}×`,
    label: "faster builds than the StyleX port of the same three applications",
    source: "Full three-way corpus (sprint 2)",
  },
  {
    id: "css",
    value: `${total("css", "Kirana")} kB`,
    label: `of CSS for all three, gzipped: StyleX ${total("css", "StyleX")} kB, Tailwind ${total("css", "Tailwind")} kB`,
    source: "Full three-way corpus (sprint 2)",
  },
  {
    id: "recalculation",
    value: "3.1–3.7×",
    label: "less style recalculation in the browser than the Tailwind original",
    source: "Runtime (E-07, KRN-PERF-006)",
  },
  {
    id: "edit",
    value: "36.8 ms",
    label: "from saving a file to the updated stylesheet, median",
    source: "Output and build changes (sprint 3, 2026-09-21)",
  },
  {
    id: "hover",
    value: "1.2 ms",
    label: "for a hover in the editor, at the 95th percentile",
    source: "E-06 language server",
  },
  {
    id: "runtime",
    value: `< ${RUNTIME_SIZE}`,
    label:
      "of runtime, gzipped, and only in modules that merge styles or take runtime values",
    source: "design-notes/runtime-merge.md",
  },
]
