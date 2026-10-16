/**
 * The site's measured numbers, read from `benchmarks.json`: kirana-lab's newest run whose
 * conformance passed, taken by `scripts/take-benchmarks.ts` (the `benchmarks` workflow opens the
 * PR). The lab builds the same three applications with the published Kirana release, the StyleX
 * port (compiled by StyleX's Babel plugin and by its SWC compiler) and the Tailwind original, cold
 * and interleaved, and compares each pair by the ratio of their medians with a 95 % confidence
 * interval (its METHODOLOGY.md).
 *
 * Nothing here is typed by hand except the editor figures, which the lab does not measure yet and
 * which name the design note they come from. Every claim is worded from a comparison's verdict: a
 * difference whose interval includes 1 is "level", so a page cannot say more than the run measured.
 */
import data from "./benchmarks.json"

/**
 * The private runtime's cap, minified and gzipped: KRN-DYN-005 holds it under 1,000 bytes, and
 * `npm/core/test/internal.test.ts` asserts it (design-notes/runtime-merge.md). Prose says "under
 * {{fact:runtime-size}}"; a component reads this.
 */
export const RUNTIME_SIZE = "1 kB"

export type Tool = "Kirana" | "StyleX" | "StyleX (SWC)" | "Tailwind"
type Target = "kirana" | "stylex" | "stylex-swc" | "tailwind"
type Other = Exclude<Target, "kirana">
const TARGET: Record<Tool, Target> = {
  Kirana: "kirana",
  StyleX: "stylex",
  "StyleX (SWC)": "stylex-swc",
  Tailwind: "tailwind",
}
/** "StyleX" is its Babel plugin, the compiler StyleX documents first; SWC is named. */
export const NAME: Record<Other, string> = {
  stylex: "StyleX",
  "stylex-swc": "StyleX (SWC)",
  tailwind: "Tailwind",
}

export const APPS = ["web", "blocks", "examples"] as const
export type Corpus = (typeof APPS)[number] | "total"

export type Verdict = "lower" | "higher" | "no clear difference"

export type Row = {
  tier: string
  corpus: string
  target: Target
  scenario: string
  metric: string
  unit: string
  n: number
  median: number
  min: number
  max: number
}

export type Comparison = {
  corpus: string
  scenario: string
  metric: string
  unit: string
  against: Other
  ratio: number
  low: number
  high: number
  verdict: Verdict
}

type Bench = {
  source: { tag: string; release: string; results: string; report: string }
  meta: {
    date: string
    corpusCommit: string
    kirana: string
    targets: Record<string, string>
    hardware: { cpu: string; cores: number; ramGb: number; os: string }
    runtime: { node: string; bun: string; chrome?: string }
    runner?: string
    run?: string
    rounds: { build: number; runtime: number; warmup: number }
    conformance: Record<string, string>
  }
  rows: Row[]
  comparisons: Comparison[]
}

const taken = data as Bench
const named = Object.values(TARGET)

/**
 * The run as the site reads it: the targets it names. A target the lab measures that the site does
 * not name yet stays off the pages until `TARGET` and `NAME` include it.
 */
export const BENCH: Bench = {
  ...taken,
  rows: taken.rows.filter((entry) => named.includes(entry.target)),
  comparisons: taken.comparisons.filter((entry) =>
    named.includes(entry.against)
  ),
}

/**
 * The tools this run measured, in the site's order. A run from before the lab built StyleX with
 * SWC has no `stylex-swc` rows, and then no page shows it.
 */
export const TOOLS: readonly Tool[] = (Object.keys(TARGET) as Tool[]).filter(
  (tool) => BENCH.rows.some((entry) => entry.target === TARGET[tool])
)
export const OTHERS: readonly Other[] = TOOLS.filter(
  (tool) => tool !== "Kirana"
).map((tool) => TARGET[tool] as Other)
/** StyleX's builds in this run: its Babel plugin, and its SWC compiler when measured. */
const STYLEX = OTHERS.filter((other) => other !== "tailwind")

export const LAB = "https://github.com/kirana-style/kirana-lab"
export const METHODOLOGY = `${LAB}/blob/main/METHODOLOGY.md`
/** The run's page on GitHub Actions, or the release when the run was not on CI. */
export const BENCH_RUN = BENCH.meta.run ?? BENCH.source.release
/** `YYYY-MM-DD` of the run. */
export const BENCH_DATE = BENCH.meta.date.slice(0, 10)

/** What the run measured on: "GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB". */
export const BENCH_MACHINE = `${BENCH.meta.runner ? "GitHub-hosted runner" : "developer machine"}, ${BENCH.meta.hardware.cores} cores (${BENCH.meta.hardware.cpu.replace(/ \d+-Core Processor$/, "")}), ${BENCH.meta.hardware.ramGb} GB`

export const corpusId = (corpus: Corpus) => `three-way/${corpus}`

/** The browser scenarios, in the run's order: `CPU throttled 4×, about 6211 elements`. */
export const BROWSER: readonly string[] = [
  ...new Set(
    BENCH.rows
      .filter((entry) => entry.scenario !== "build")
      .map((entry) => entry.scenario)
  ),
]

export function row(
  corpus: Corpus,
  scenario: string,
  metric: string,
  tool: Tool
): Row {
  const found = BENCH.rows.find(
    (entry) =>
      entry.corpus === corpusId(corpus) &&
      entry.scenario === scenario &&
      entry.metric === metric &&
      entry.target === TARGET[tool]
  )
  if (!found)
    throw new Error(`benchmarks.json: no ${tool} ${metric} for ${corpus}`)
  return found
}

export function comparison(
  corpus: Corpus,
  scenario: string,
  metric: string,
  against: Other
): Comparison | undefined {
  return BENCH.comparisons.find(
    (entry) =>
      entry.corpus === corpusId(corpus) &&
      entry.scenario === scenario &&
      entry.metric === metric &&
      entry.against === against
  )
}

function required(...args: Parameters<typeof comparison>): Comparison {
  const found = comparison(...args)
  if (!found)
    throw new Error(
      `benchmarks.json: no ${args[2]} against ${args[3]} for ${args[0]}`
    )
  return found
}

/** A value in the unit a reader expects: seconds from a second up, kB for bytes. */
export function formatValue(value: number, unit: string): string {
  if (unit === "ms")
    return value >= 1000
      ? `${(value / 1000).toFixed(2)} s`
      : `${value.toFixed(1)} ms`
  if (unit === "bytes") return `${(value / 1000).toFixed(1)} kB`
  return value.toLocaleString("en", { maximumFractionDigits: 0 })
}

const percent = (fraction: number) => {
  const value = Math.round(fraction * 100)
  return value < 1 ? "under 1 %" : `${value} %`
}

/**
 * Kirana against another build, in words: "3.2× faster than StyleX", "2 % larger than StyleX",
 * or "level with Tailwind" when the interval includes 1. Times are faster or slower, sizes
 * smaller or larger; a factor reads as a multiple from 1.5×, as a percentage below it.
 */
export function claim(entry: Comparison, kind: "time" | "size"): string {
  const name = NAME[entry.against]
  if (entry.verdict === "no clear difference") return `level with ${name}`
  const [less, more] =
    kind === "time" ? ["faster", "slower"] : ["smaller", "larger"]
  if (entry.verdict === "lower") {
    const factor = 1 / entry.ratio
    return factor >= 1.5
      ? `${factor.toFixed(1)}× ${less} than ${name}`
      : `${percent(1 - entry.ratio)} ${less} than ${name}`
  }
  return entry.ratio >= 1.5
    ? `${entry.ratio.toFixed(1)}× ${more} than ${name}`
    : `${percent(entry.ratio - 1)} ${more} than ${name}`
}

/**
 * Kirana against StyleX on one measure over all three apps: against whichever of StyleX's builds
 * Kirana does least well against, so a claim about StyleX holds whichever compiler a reader uses.
 */
const stylex = (metric: string): Comparison =>
  STYLEX.map((other) => required("total", "build", metric, other)).reduce(
    (worst, entry) => (entry.ratio > worst.ratio ? entry : worst)
  )

const total = (metric: string, kind: "time" | "size") =>
  claim(required("total", "build", metric, "tailwind"), kind)

/**
 * The claims prose may make, each worded from its comparison over all three apps. Markdown writes
 * them as `{{fact:bench-…}}` (facts.ts); components read them here.
 */
export const CLAIMS = {
  buildStylex: claim(stylex("build"), "time"),
  buildTailwind: total("build", "time"),
  cssStylex: claim(stylex("cssGzip"), "size"),
  cssTailwind: total("cssGzip", "size"),
  bytesStylex: claim(stylex("totalGzip"), "size"),
  bytesTailwind: total("totalGzip", "size"),
}

export const capital = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

export type Metric = {
  id: string
  label: string
  unit: string
  /** Decimal places every value is shown with. */
  digits: number
  /** One value per app, in `APPS` order. */
  values: Record<Tool, readonly number[]>
  total: Record<Tool, number>
  /** Lower is better for every metric here. */
  note: string
}

function chartMetric(
  id: string,
  label: string,
  name: string,
  unit: string,
  note: string
): Metric {
  // Seconds from milliseconds to two places, as `formatValue` shows them; kB from bytes to one.
  const digits = unit === "s" ? 2 : 1
  const value = (corpus: Corpus, tool: Tool) =>
    Number((row(corpus, "build", name, tool).median / 1000).toFixed(digits))
  const byTool = <T>(read: (tool: Tool) => T) =>
    Object.fromEntries(TOOLS.map((tool) => [tool, read(tool)])) as Record<
      Tool,
      T
    >
  return {
    id,
    label,
    unit,
    digits,
    values: byTool((tool) => APPS.map((app) => value(app, tool))),
    total: byTool((tool) => value("total", tool)),
    note,
  }
}

/** The compiler page's chart: the corpus total per tool, and each app beneath. */
export const METRICS: readonly Metric[] = [
  chartMetric(
    "build",
    "Build time",
    "build",
    "s",
    `${capital(CLAIMS.buildStylex)}; ${CLAIMS.buildTailwind}.`
  ),
  chartMetric(
    "css",
    "CSS, gzip",
    "cssGzip",
    "kB",
    `${capital(CLAIMS.cssStylex)} and ${CLAIMS.cssTailwind}, gzipped.`
  ),
  chartMetric(
    "total",
    "CSS + JS, gzip",
    "totalGzip",
    "kB",
    `${capital(CLAIMS.bytesStylex)} and ${CLAIMS.bytesTailwind}, over the three apps.`
  ),
]

/**
 * A figure for a comparison, worded from its verdict: "3.2×" and "faster cold builds than
 * StyleX", or "1×" and "cold builds level with StyleX".
 */
function multiple(
  entry: Comparison,
  words: { lower: string; higher: string; level: string }
) {
  const name = NAME[entry.against]
  if (entry.verdict === "no clear difference")
    return { value: "1×", label: `${words.level} ${name}` }
  return entry.verdict === "lower"
    ? {
        value: `${(1 / entry.ratio).toFixed(1)}×`,
        label: `${words.lower} ${name}`,
      }
    : { value: `${entry.ratio.toFixed(1)}×`, label: `${words.higher} ${name}` }
}

const SCHEME = BROWSER[0]!
const LAB_SOURCE = `kirana-lab, Kirana ${BENCH.meta.kirana}, ${BENCH_DATE}`
const NOTES = "packages/kirana/design-notes/benchmark-results.md"
const bytes = (tool: Tool) =>
  formatValue(row("total", "build", "totalGzip", tool).median, "bytes")

/**
 * The figures the homepage leads with. The build and browser figures come from the lab's run; the
 * editor figures from one developer machine, in the design note `link` names.
 */
export const HEADLINES: readonly {
  id: string
  value: string
  label: string
  source: string
  /** Where the number is measured: a URL, or a path in this repository. */
  link: string
}[] = [
  {
    id: "build",
    ...multiple(stylex("build"), {
      lower: "faster cold builds than",
      higher: "slower cold builds than",
      level: "cold builds level with",
    }),
    source: LAB_SOURCE,
    link: BENCH_RUN,
  },
  {
    id: "bytes",
    value: bytes("Kirana"),
    label: `of CSS and JavaScript for all three apps, gzipped: ${TOOLS.filter(
      (tool) => tool !== "Kirana"
    )
      .map((tool) => `${tool} ${bytes(tool)}`)
      .join(", ")}`,
    source: LAB_SOURCE,
    link: BENCH_RUN,
  },
  {
    id: "recalculation",
    ...multiple(required("web", SCHEME, "scheme", "tailwind"), {
      lower: "less style recalculation on a colour-scheme switch than",
      higher: "more style recalculation on a colour-scheme switch than",
      level: "style recalculation on a colour-scheme switch level with",
    }),
    source: `${LAB_SOURCE}, ${SCHEME.split(",")[0]}`,
    link: BENCH_RUN,
  },
  {
    id: "edit",
    value: "36.8 ms",
    label: "from saving a file to the updated stylesheet, median",
    source: "One developer machine",
    link: NOTES,
  },
  {
    id: "hover",
    value: "1.2 ms",
    label: "for a hover in the editor, at the 95th percentile",
    source: "One developer machine",
    link: NOTES,
  },
  {
    id: "runtime",
    value: `< ${RUNTIME_SIZE}`,
    label:
      "of runtime, gzipped, and only in modules that merge styles or take runtime values",
    source: "Asserted by the core package's tests",
    link: "packages/kirana/design-notes/runtime-merge.md",
  },
]

/** The measures a report shows, in order, with what they are called and whether they are judged. */
export const MEASURES: readonly {
  metric: string
  label: string
  kind: "time" | "size" | "count"
  /** Counts of rules and declarations are shown without a verdict (the lab's report says why). */
  judged: boolean
}[] = [
  { metric: "build", label: "Build, cold", kind: "time", judged: true },
  { metric: "cssRaw", label: "CSS", kind: "size", judged: true },
  { metric: "cssGzip", label: "CSS, gzip", kind: "size", judged: true },
  { metric: "cssBrotli", label: "CSS, brotli", kind: "size", judged: true },
  { metric: "jsRaw", label: "JavaScript", kind: "size", judged: true },
  { metric: "jsGzip", label: "JavaScript, gzip", kind: "size", judged: true },
  {
    metric: "totalGzip",
    label: "CSS + JavaScript, gzip",
    kind: "size",
    judged: true,
  },
  { metric: "rules", label: "Style rules", kind: "count", judged: false },
  {
    metric: "declarations",
    label: "Declarations",
    kind: "count",
    judged: false,
  },
  {
    metric: "scheme",
    label: "Colour-scheme switch, style recalc",
    kind: "time",
    judged: true,
  },
  {
    metric: "schemeRecalcs",
    label: "Colour-scheme switch, recalcs",
    kind: "count",
    judged: true,
  },
  { metric: "hover", label: "Hover, style recalc", kind: "time", judged: true },
  {
    metric: "hoverRecalcs",
    label: "Hover, recalcs",
    kind: "count",
    judged: true,
  },
  { metric: "layout", label: "Layout", kind: "time", judged: true },
  { metric: "framesP95", label: "Frame time, p95", kind: "time", judged: true },
]

/** `0.31× (0.31–0.31)`: a ratio and its interval, to two places, or three when two would show one of them as 1.00. */
export function ratioText(entry: Comparison): string {
  const values = [entry.ratio, entry.low, entry.high]
  const places = values.some((value) => value.toFixed(2) === "1.00") ? 3 : 2
  const [ratio, low, high] = values.map((value) => value.toFixed(places))
  return `${ratio}× (${low}–${high})`
}

export type ReportTable = {
  head: string[]
  rows: { measure: string; values: string[]; ratios: (Comparison | null)[] }[]
}

/** One report table: every measure the run has for a corpus and scenario. */
export function reportTable(corpus: Corpus, scenario: string): ReportTable {
  const rows = MEASURES.flatMap((measure) => {
    const has = BENCH.rows.some(
      (entry) =>
        entry.corpus === corpusId(corpus) &&
        entry.scenario === scenario &&
        entry.metric === measure.metric
    )
    if (!has) return []
    return [
      {
        measure: measure.label,
        values: TOOLS.map((tool) => {
          const entry = row(corpus, scenario, measure.metric, tool)
          return formatValue(entry.median, entry.unit)
        }),
        ratios: OTHERS.map((other) =>
          measure.judged
            ? (comparison(corpus, scenario, measure.metric, other) ?? null)
            : null
        ),
      },
    ]
  })
  return {
    head: [
      "Measure",
      ...TOOLS,
      ...OTHERS.map((other) => `Kirana ÷ ${NAME[other]}`),
    ],
    rows,
  }
}

const CORPUS_LABEL = (corpus: string) =>
  corpus === "three-way/total"
    ? "all three apps"
    : `apps/${corpus.split("/")[1]}`

/**
 * Every judged comparison where Kirana measured higher: the report's "where Kirana is behind",
 * worded "CSS, gzip, all three apps: 1.02× StyleX (1.02–1.02)".
 */
export const BEHIND: readonly string[] = BENCH.comparisons
  .filter((entry) => entry.verdict === "higher")
  .flatMap((entry) => {
    const measure = MEASURES.find((item) => item.metric === entry.metric)
    if (!measure?.judged) return []
    const where =
      entry.scenario === "build"
        ? CORPUS_LABEL(entry.corpus)
        : `${CORPUS_LABEL(entry.corpus)}, ${entry.scenario}`
    return [
      `${measure.label}, ${where}: ${ratioText(entry).replace("×", `× ${NAME[entry.against]}`)}`,
    ]
  })

/** The run, as label and value pairs: what produced the numbers. */
export const RUN_FACTS: readonly [string, string][] = [
  ["Kirana", `${BENCH.meta.kirana}, from npm`],
  ["Date", BENCH_DATE],
  [
    "Versions",
    Object.entries(BENCH.meta.targets)
      .filter(([name]) => name !== "@kirana-style/vite")
      .map(([name, version]) => `${name} ${version}`)
      .join(", "),
  ],
  ["Machine", `${BENCH_MACHINE}, ${BENCH.meta.hardware.os}`],
  [
    "Tools",
    [
      `Node.js ${BENCH.meta.runtime.node}`,
      `Bun ${BENCH.meta.runtime.bun}`,
      BENCH.meta.runtime.chrome && `Chrome ${BENCH.meta.runtime.chrome}`,
    ]
      .filter(Boolean)
      .join(", "),
  ],
  [
    "Rounds",
    `${BENCH.meta.rounds.build} cold builds per app after ${BENCH.meta.rounds.warmup} warm-up; ${BENCH.meta.rounds.runtime} browser runs`,
  ],
  [
    "Conformance",
    Object.entries(BENCH.meta.conformance)
      .map(([app, outcome]) => `${app} ${outcome}`)
      .join(", "),
  ],
]

/** The report's plain twin for language models: `<!-- ::benchmarks part="…" … -->`. */
export function benchmarksMarkdown({
  part,
  corpus,
  scenario,
}: Record<string, string>): string {
  if (part === "run")
    return [
      "| | |",
      "| --- | --- |",
      ...RUN_FACTS.map(([label, value]) => `| ${label} | ${value} |`),
      `| Run | ${BENCH_RUN} |`,
    ].join("\n")
  if (part === "behind")
    return BEHIND.length === 0
      ? "Nothing: every judged measure is lower for Kirana or level."
      : BEHIND.map((line) => `- ${line}`).join("\n")
  const table = reportTable(
    (corpus ?? "total") as Corpus,
    part === "browser" ? BROWSER[Number(scenario ?? 0)]! : "build"
  )
  return [
    `| ${table.head.join(" | ")} |`,
    `| ${table.head.map(() => "---").join(" | ")} |`,
    ...table.rows.map(
      (entry) =>
        `| ${[
          entry.measure,
          ...entry.values,
          ...entry.ratios.map((ratio) =>
            ratio ? `${ratioText(ratio)} ${ratio.verdict}` : "not judged"
          ),
        ].join(" | ")} |`
    ),
  ].join("\n")
}
