/**
 * `<!-- ::benchmarks part="…" -->`: kirana-lab's newest run, from `data/benchmarks.ts`.
 *
 *   part="run"                          what produced the numbers, with links to the run
 *   part="behind"                       every judged measure where Kirana measured higher
 *   part="build" corpus="total|web|…"   build and output, one app or all three
 *   part="browser" corpus="web" scenario="0|1"   the browser measures at one throttling rate
 *   part="large-dom"                    the large-dom table: its app's build, then each size
 *
 * Each table cell is a median; each ratio is Kirana's median over the other's with its 95 %
 * confidence interval and the verdict it supports.
 */
import { css } from "@kirana-style/core"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import {
  BEHIND,
  BENCH,
  BENCH_RUN,
  BROWSER,
  METHODOLOGY,
  LARGE_DOM_MISSING,
  RUN_FACTS,
  largeDomTables,
  ratioText,
  reportTable,
} from "@/data/benchmarks"
import type { Comparison, Corpus, ReportTable } from "@/data/benchmarks"

const styles = {
  wrapper: css({ marginBlockEnd: spacing[6], overflowX: "auto" }),
  // "Kirana ÷ StyleX (SWC)" breaks across lines rather than widening its column.
  head: css({ whiteSpace: "normal", verticalAlign: "bottom" }),
  measure: css({ whiteSpace: "normal", minWidth: "6rem" }),
  number: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    // Eight columns in the measure of a docs page: a little less space before each number.
    paddingInlineStart: spacing["1.5"],
  }),
  // The verdict wraps ("no clear difference"), so the ratio columns fit beside each other.
  verdict: css({
    display: "block",
    whiteSpace: "normal",
    fontFamily: fontFamily.sans,
    color: theme.mutedForeground,
  }),
  interval: css({ display: "block", color: theme.mutedForeground }),
  higher: css({ color: theme.foreground, fontWeight: fontWeight.semibold }),
  facts: css({
    display: "grid",
    marginBlockEnd: spacing[6],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  fact: css({
    display: "grid",
    columnGap: spacing[4],
    rowGap: spacing[1],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "9rem minmax(0, 1fr)",
    },
    paddingBlock: spacing[3],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  label: css({ fontWeight: fontWeight.medium }),
  behind: css({
    display: "grid",
    gap: spacing[2],
    marginBlockEnd: spacing[6],
    paddingInlineStart: spacing[6],
    listStyleType: "disc",
    lineHeight: "1.6",
  }),
  value: css({ color: theme.mutedForeground, overflowWrap: "anywhere" }),
  caption: css({
    marginBlockEnd: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
}

const LINKS: [string, string][] = [
  ["The run", BENCH_RUN],
  ["The release", BENCH.source.release],
  ["Every raw sample (results.json)", BENCH.source.results],
  ["The method (METHODOLOGY.md)", METHODOLOGY],
]

function Run() {
  return (
    <dl sx={styles.facts}>
      {RUN_FACTS.map(([label, value]) => (
        <div key={label} sx={styles.fact}>
          <dt sx={styles.label}>{label}</dt>
          <dd sx={styles.value}>{value}</dd>
        </div>
      ))}
      <div sx={styles.fact}>
        <dt sx={styles.label}>Links</dt>
        <dd sx={styles.value}>
          {LINKS.map(([label, href], index) => (
            <span key={href}>
              {index > 0 ? " · " : null}
              <a href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            </span>
          ))}
        </dd>
      </div>
    </dl>
  )
}

/** The ratio on its line, and its interval and verdict beneath, so a column stays narrow. */
function Ratio({ entry }: { entry: Comparison | null }) {
  if (!entry) return <span sx={styles.verdict}>not judged</span>
  const [ratio, interval] = ratioText(entry).split(" ")
  return (
    <>
      {ratio}
      <span sx={styles.interval}>{interval}</span>
      <span
        sx={[styles.verdict, entry.verdict === "higher" ? styles.higher : null]}
      >
        {entry.verdict}
      </span>
    </>
  )
}

function Report({ corpus, scenario }: { corpus: Corpus; scenario: string }) {
  return <ReportTableView table={reportTable(corpus, scenario)} />
}

function ReportTableView({ table }: { table: ReportTable }) {
  return (
    <div sx={styles.wrapper}>
      <Table>
        <TableHeader>
          <TableRow>
            {table.head.map((cell) => (
              <TableHead key={cell} sx={styles.head}>
                {cell}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((entry) => (
            <TableRow key={entry.measure}>
              <TableCell sx={styles.measure}>{entry.measure}</TableCell>
              {entry.values.map((value, index) => (
                <TableCell key={index} sx={styles.number}>
                  {value}
                </TableCell>
              ))}
              {entry.ratios.map((ratio, index) => (
                <TableCell key={`ratio-${index}`} sx={styles.number}>
                  <Ratio entry={ratio} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function Benchmarks({
  part,
  corpus = "total",
  scenario = "0",
}: {
  part: string
  corpus?: string
  scenario?: string
}) {
  if (part === "run") return <Run />
  if (part === "large-dom") {
    const tables = largeDomTables()
    if (tables.length === 0) return <p>{LARGE_DOM_MISSING}</p>
    return tables.map(({ title, table }) => (
      <section key={title} aria-label={title}>
        <p sx={styles.caption}>{title}</p>
        <ReportTableView table={table} />
      </section>
    ))
  }
  if (part === "behind")
    return BEHIND.length === 0 ? (
      <p>Nothing: every judged measure is lower for Kirana or level.</p>
    ) : (
      <ul sx={styles.behind}>
        {BEHIND.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    )
  return (
    <Report
      corpus={corpus as Corpus}
      scenario={part === "browser" ? BROWSER[Number(scenario)]! : "build"}
    />
  )
}
