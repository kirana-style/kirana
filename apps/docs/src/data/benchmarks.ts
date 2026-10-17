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
 * The private runtime's cap, minified and gzipped: KRN-DYN-005 holds it under 1,100 bytes (D-083), and
 * `npm/core/test/internal.test.ts` asserts it (design-notes/runtime-merge.md). Prose says "under
 * {{fact:runtime-size}}"; a component reads this.
 */
export const RUNTIME_SIZE = "1.1 kB"

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
/**
 * A three-way app or their total; the large-dom corpus (`large-dom` is its app's build and
 * `large-dom/<rows>` its table at one size); or the scale curve at one size, `scale-curve/<n>`.
 */
export type Corpus =
  | (typeof APPS)[number]
  | "total"
  | "large-dom"
  | `large-dom/${number}`
  | `scale-curve/${number}`

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
    rounds: {
      build: number
      runtime: number
      warmup: number
      largeDom?: number
      scaleCurve?: number
    }
    conformance: Record<string, string>
    /** The scale curve's own runner, when a job of its own measured it. */
    scaleCurve?: {
      hardware: { cpu: string; cores: number; ramGb: number; os: string }
      runner?: string
    }
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

export const corpusId = (corpus: Corpus) =>
  corpus.startsWith("large-dom") || corpus.startsWith("scale-curve/")
    ? corpus
    : `three-way/${corpus}`

/** The `web` app's browser scenarios, in the run's order: `CPU throttled 4×, about 6211 elements`. */
export const BROWSER: readonly string[] = [
  ...new Set(
    BENCH.rows
      .filter(
        (entry) =>
          entry.corpus === corpusId("web") && entry.scenario !== "build"
      )
      .map((entry) => entry.scenario)
  ),
]

/**
 * The large-dom table's sizes this run measured, smallest first, each with its browser scenario
 * (`CPU throttled 4×, about 22552 elements`); none for a run from before the lab had the corpus.
 */
export const LARGE_DOM: readonly {
  corpus: Corpus
  rows: number
  scenario: string
}[] = [
  ...new Set(
    BENCH.rows
      .map((entry) => /^large-dom\/(\d+)$/.exec(entry.corpus)?.[1])
      .filter((rows): rows is string => rows !== undefined)
  ),
]
  .map(Number)
  .sort((a, b) => a - b)
  .map((rows) => ({
    corpus: `large-dom/${rows}` as Corpus,
    rows,
    scenario: BENCH.rows.find(
      (entry) =>
        entry.corpus === `large-dom/${rows}` && entry.scenario !== "build"
    )!.scenario,
  }))

/** The scale curve's sizes this run measured, smallest first; none for a run without it. */
export const SCALE_CURVE: readonly number[] = [
  ...new Set(
    BENCH.rows
      .map((entry) => /^scale-curve\/(\d+)$/.exec(entry.corpus)?.[1])
      .filter((size): size is string => size !== undefined)
      .map(Number)
  ),
].sort((a, b) => a - b)

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

/** A value in the unit a reader expects: seconds from a second up, kB for bytes, MB from a megabyte. */
export function formatValue(value: number, unit: string): string {
  if (unit === "ms")
    return value >= 1000
      ? `${(value / 1000).toFixed(2)} s`
      : `${value.toFixed(1)} ms`
  if (unit === "bytes")
    return value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)} MB`
      : `${(value / 1000).toFixed(1)} kB`
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
  { metric: "html", label: "HTML", kind: "size", judged: true },
  {
    metric: "classBytes",
    label: "class attributes",
    kind: "size",
    judged: true,
  },
  {
    metric: "filter",
    label: "Filter, to the next frame",
    kind: "time",
    judged: true,
  },
  {
    metric: "filterRecalc",
    label: "Filter, style recalc",
    kind: "time",
    judged: true,
  },
  {
    metric: "filterLayout",
    label: "Filter, layout",
    kind: "time",
    judged: true,
  },
  {
    metric: "restore",
    label: "Every row again, to the next frame",
    kind: "time",
    judged: true,
  },
  {
    metric: "restoreRecalc",
    label: "Every row again, style recalc",
    kind: "time",
    judged: true,
  },
  {
    metric: "restoreLayout",
    label: "Every row again, layout",
    kind: "time",
    judged: true,
  },
  {
    metric: "scrollP95",
    label: "Scroll, frame time p95",
    kind: "time",
    judged: true,
  },
  {
    metric: "scrollRecalc",
    label: "Scroll, style recalc",
    kind: "time",
    judged: true,
  },
  {
    metric: "hoverRecalc",
    label: "Hover across rows, style recalc",
    kind: "time",
    judged: true,
  },
  { metric: "heap", label: "JavaScript heap", kind: "size", judged: true },
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

/**
 * One report table: every measure the run has for a corpus in a scenario, or in any of several (a
 * large-dom size's page bytes, then its browser measures).
 */
export function reportTable(
  corpus: Corpus,
  scenarios: string | readonly string[]
): ReportTable {
  const rows = MEASURES.flatMap((measure) => {
    const scenario = [scenarios]
      .flat()
      .find((candidate) =>
        BENCH.rows.some(
          (entry) =>
            entry.corpus === corpusId(corpus) &&
            entry.scenario === candidate &&
            entry.metric === measure.metric
        )
      )
    if (scenario === undefined) return []
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
  if (rows.length === 0)
    throw new Error(
      `benchmarks.json: no measures for ${corpus}, ${[scenarios].flat().join(" or ")}; a page asks for a table the run does not have`
    )
  return {
    head: [
      "Measure",
      ...TOOLS,
      ...OTHERS.map((other) => `Kirana ÷ ${NAME[other]}`),
    ],
    rows,
  }
}

const CORPUS_LABEL = (corpus: string) => {
  if (corpus === "three-way/total") return "all three apps"
  const [name, part] = corpus.split("/")
  if (name === "scale-curve")
    return `the scale curve, ${Number(part).toLocaleString("en")} components`
  if (name !== "large-dom") return `apps/${part}`
  return part
    ? `the large-dom table, ${Number(part).toLocaleString("en")} rows`
    : "apps/large-dom"
}

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

/**
 * The large-dom corpus as tables: its app's build, then the table at each size the run measured,
 * each titled "1,000 rows, CPU throttled 4×, about 22552 elements". Empty for a run without it.
 */
export function largeDomTables(): { title: string; table: ReportTable }[] {
  if (LARGE_DOM.length === 0) return []
  return [
    { title: "The app's build", table: reportTable("large-dom", "build") },
    ...LARGE_DOM.map((size) => ({
      title: `${size.rows.toLocaleString("en")} rows, ${size.scenario}`,
      table: reportTable(size.corpus, ["build", size.scenario]),
    })),
  ]
}

/** What a page says where the large-dom tables would be, for a run that did not measure them. */
export const LARGE_DOM_MISSING = "This run did not measure the large-dom table."

/**
 * The scale curve as tables: build time and CSS + JavaScript gzipped at every size, a row per tool
 * and Kirana's ratio beneath; then each size's every measure. Empty for a run without it.
 */
export function scaleCurveTables(): { title: string; table: ReportTable }[] {
  if (SCALE_CURVE.length === 0) return []
  const head = ["", ...SCALE_CURVE.map((size) => size.toLocaleString("en"))]
  const corpus = (size: number) => `scale-curve/${size}` as Corpus
  const curve = (metric: string) => ({
    head,
    rows: [
      ...TOOLS.map((tool) => ({
        measure: tool,
        values: SCALE_CURVE.map((size) => {
          const entry = row(corpus(size), "build", metric, tool)
          return formatValue(entry.median, entry.unit)
        }),
        ratios: [],
      })),
      ...OTHERS.map((other) => ({
        measure: `Kirana ÷ ${NAME[other]}`,
        values: [],
        ratios: SCALE_CURVE.map(
          (size) => comparison(corpus(size), "build", metric, other) ?? null
        ),
      })),
    ],
  })
  return [
    { title: "Build, cold, at every size", table: curve("build") },
    {
      title: "CSS + JavaScript, gzip, at every size",
      table: curve("totalGzip"),
    },
    ...SCALE_CURVE.map((size) => ({
      title: `${size.toLocaleString("en")} components`,
      table: reportTable(corpus(size), "build"),
    })),
  ]
}

/** What a page says where the scale curve would be, for a run that did not measure it. */
export const SCALE_CURVE_MISSING = "This run did not measure the scale curve."

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
    `${BENCH.meta.rounds.build} cold builds per app after ${BENCH.meta.rounds.warmup} warm-up; ${BENCH.meta.rounds.runtime} browser runs${BENCH.meta.rounds.largeDom ? `; ${BENCH.meta.rounds.largeDom} rounds at each large-dom size` : ""}${BENCH.meta.rounds.scaleCurve ? `; ${BENCH.meta.rounds.scaleCurve} cold builds at each scale-curve size` : ""}`,
  ],
  ...(BENCH.meta.scaleCurve?.runner
    ? ([
        [
          "Scale curve",
          `its own GitHub-hosted runner, ${BENCH.meta.scaleCurve.hardware.cores} cores (${BENCH.meta.scaleCurve.hardware.cpu.replace(/ \d+-Core Processor$/, "")}), ${BENCH.meta.scaleCurve.hardware.ramGb} GB`,
        ],
      ] as [string, string][])
    : []),
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
  if (part === "scale-curve") {
    const tables = scaleCurveTables()
    return tables.length === 0
      ? SCALE_CURVE_MISSING
      : tables
          .map(({ title, table }) => `**${title}**\n\n${markdownTable(table)}`)
          .join("\n\n")
  }
  if (part === "large-dom") {
    const tables = largeDomTables()
    return tables.length === 0
      ? LARGE_DOM_MISSING
      : tables
          .map(({ title, table }) => `**${title}**\n\n${markdownTable(table)}`)
          .join("\n\n")
  }
  return markdownTable(
    reportTable(
      (corpus ?? "total") as Corpus,
      part === "browser" ? BROWSER[Number(scenario ?? 0)]! : "build"
    )
  )
}

/** A report table as Markdown, a ratio's verdict beside it. */
function markdownTable(table: ReportTable): string {
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
