/**
 * `kirana-style ui view <item…>` (KRN-DX-027): what an item is and what installing it would bring,
 * read and checked as KRN-DX-026 reads it, without a file's content.
 */
import { failureLine, parseArgs } from "./command.ts"
import type { Failure, Options } from "./command.ts"
import { read, RegistryError } from "./read.ts"
import { REFERENCE_PATTERN } from "./schema.ts"
import { loadSettings } from "./settings.ts"
import type { Item, Packages, RegistryFile } from "./types.ts"

/** Where a file installs: under the alias for its type, or at its own `target`. */
const placeOf = (file: RegistryFile) =>
  // A `file` without its target does not pass `read`.
  file.type === "file" ? file.target! : `${file.type}/${file.path}`

const packagesOf = (packages: Packages = {}) =>
  Object.entries(packages).map(([name, range]) => `${name} ${range}`)

/** An item as `view` prints it: a heading, then one labelled line per field it has. */
export function describe(reference: string, url: URL, item: Item): string {
  const lines = [`${reference} ${item.version} · ${item.type}`]
  const summary = [item.title, item.description].filter(Boolean).join(": ")
  if (summary) lines.push(summary)
  lines.push(`from ${url.href}`, "")
  const rows: [string, string[]][] = [
    ["kirana", item.kirana ? [item.kirana] : []],
    ["registry", item.registryDependencies ?? []],
    ["packages", packagesOf(item.dependencies)],
    ["axes", item.axes ?? []],
    ["styles", (item.styles ?? []).map(placeOf)],
  ]
  for (const [framework, bases] of Object.entries(item.frameworks ?? {}))
    for (const [base, entry] of Object.entries(bases)) {
      const packages = packagesOf(entry.dependencies)
      rows.push([
        `${framework}/${base}`,
        [
          entry.files.map(placeOf).join(", ") +
            (packages.length > 0 ? ` · ${packages.join(", ")}` : ""),
        ],
      ])
    }
  rows.push(["files", (item.files ?? []).map(placeOf)])
  const shown = rows.filter(([, values]) => values.length > 0)
  const width = Math.max(...shown.map(([label]) => label.length))
  for (const [label, values] of shown)
    lines.push(`  ${label.padEnd(width)}  ${values.join(", ")}`)
  return `${lines.join("\n")}\n`
}

/**
 * Reads each item and prints it, or with `--json` `{ items, failures }`. Exit 1 when one cannot be
 * read, 2 without an item, with an unknown option, or with settings it cannot use.
 */
export async function runView(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options
): Promise<number> {
  const parsed = parseArgs("view", args, ["--json"])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  if (parsed.rest.length === 0) {
    write("kirana-style ui view needs at least one item\n")
    return 2
  }
  let settings
  try {
    settings = await loadSettings(cwd, options.load)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 2
  }
  const readItem = async (reference: string) => {
    if (!REFERENCE_PATTERN.test(reference))
      throw new RegistryError(
        "is not an item: @namespace/name, or a name for @kirana's"
      )
    const found = await read(reference, settings, options)
    // `read` gives an index only for `index`, and never a lockfile.
    if (found.kind === "index")
      throw new RegistryError(
        "is an index: kirana-style ui search lists its items"
      )
    return { url: found.url, item: found.document as Item }
  }
  const outcomes = await Promise.allSettled(parsed.rest.map(readItem))
  const items: { reference: string; url: URL; item: Item }[] = []
  const failures: Failure[] = []
  outcomes.forEach((outcome, index) => {
    const reference = parsed.rest[index]!
    if (outcome.status === "fulfilled")
      items.push({ reference, ...outcome.value })
    else
      failures.push({
        document: reference,
        message: (outcome.reason as Error).message,
      })
  })
  if (parsed.flags.has("--json"))
    write(
      `${JSON.stringify({ items: items.map(({ item }) => item), failures }, null, 2)}\n`
    )
  else {
    write(
      items
        .map(({ reference, url, item }) => describe(reference, url, item))
        .join("\n")
    )
    for (const failure of failures) write(failureLine(failure))
  }
  return failures.length > 0 ? 1 : 0
}
