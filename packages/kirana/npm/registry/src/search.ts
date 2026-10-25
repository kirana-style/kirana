/**
 * `kirana-style ui search [query]` (KRN-DX-027): the entries of every registry's index, or of the
 * registries named with `--registry`, whose name, title or description holds every word of the query.
 */
import { failureLine, parseArgs } from "./command.ts"
import type { Failure, Options } from "./command.ts"
import { read, registryOf } from "./read.ts"
import { loadSettings } from "./settings.ts"
import type { Settings } from "./settings.ts"
import type { Index, IndexEntry } from "./types.ts"

/** An index entry found by a search, with where it is. */
export type Result = IndexEntry & { reference: string; namespace: string }

/** Whether an entry holds every word of the query in its name, title or description, ignoring case. */
export function matches(entry: IndexEntry, words: readonly string[]): boolean {
  const text = [entry.name, entry.title, entry.description]
    .join(" ")
    .toLowerCase()
  return words.every((word) => text.includes(word))
}

/** The bases of each framework, as one column: `react base, aria · vue ark`. */
const frameworksOf = (entry: IndexEntry) =>
  Object.entries(entry.frameworks ?? {})
    .map(([framework, bases]) => `${framework} ${bases.join(", ")}`)
    .join(" · ")

/** The results as aligned rows: reference, version, type, title, frameworks. */
export function table(results: readonly Result[]): string {
  const rows = results.map((result) => [
    result.reference,
    result.version,
    result.type,
    result.title ?? "",
    frameworksOf(result),
  ])
  const widths = [0, 1, 2, 3].map((column) =>
    Math.max(...rows.map((row) => row[column]!.length))
  )
  return rows
    .map(
      (row) =>
        `${row
          .map((cell, column) => cell.padEnd(widths[column] ?? 0))
          .join("  ")
          .trimEnd()}\n`
    )
    .join("")
}

/**
 * Reads the indexes and prints what matches, or with `--json` `{ results, failures }`. Exit 1 when an
 * index cannot be read, 2 for an unknown option or registry, or settings it cannot use.
 */
export async function runSearch(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options
): Promise<number> {
  const parsed = parseArgs("search", args, ["--json"], ["--registry"])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  let settings: Settings
  let namespaces: string[]
  try {
    settings = await loadSettings(cwd, options.load)
    namespaces = parsed.values.get("--registry") ?? [
      ...settings.registries.keys(),
    ]
    for (const namespace of namespaces) registryOf(namespace, settings)
  } catch (error) {
    // Settings it cannot use, or a namespace they do not name.
    write(`${(error as Error).message}\n`)
    return 2
  }
  const words = parsed.rest.join(" ").toLowerCase().split(/\s+/).filter(Boolean)
  const outcomes = await Promise.allSettled(
    namespaces.map((namespace) => read(`${namespace}/index`, settings, options))
  )
  const results: Result[] = []
  const failures: Failure[] = []
  const searched: string[] = []
  outcomes.forEach((outcome, index) => {
    const namespace = namespaces[index]!
    if (outcome.status === "rejected") {
      failures.push({
        document: `${namespace}/index`,
        message: (outcome.reason as Error).message,
      })
      return
    }
    searched.push(namespace)
    for (const entry of (outcome.value.document as Index).items)
      if (matches(entry, words))
        results.push({
          ...entry,
          reference: `${namespace}/${entry.name}`,
          namespace,
        })
  })
  if (parsed.flags.has("--json"))
    write(`${JSON.stringify({ results, failures }, null, 2)}\n`)
  else {
    if (results.length > 0) write(table(results))
    else if (searched.length > 0)
      write(
        words.length > 0
          ? `nothing in ${searched.join(", ")} matches "${words.join(" ")}"\n`
          : `no items in ${searched.join(", ")}\n`
      )
    for (const failure of failures) write(failureLine(failure))
  }
  return failures.length > 0 ? 1 : 0
}
