/**
 * Size and type budgets: what Kirana's output weighs and what its types cost, recorded in
 * `budgets/budgets.json`.
 *
 *   node scripts/budgets.ts            prints the measures and how they differ from the record
 *   node scripts/budgets.ts --update   rewrites the record
 *   node scripts/budgets.ts --check    fails when the record is out of date (CI)
 *   … --summary                        also writes the difference to $GITHUB_STEP_SUMMARY
 *
 * Every measure is deterministic: the compiler's output is (the `determinism` job holds it to
 * that), compression runs at fixed levels in Node's zlib, and TypeScript counts instantiations
 * exactly. So the record changes only when the output or the types do, and a pull request that
 * changes either shows it in its diff, for review, instead of in a timing that varies run to run.
 *
 * - `size.fixtures`: each golden fixture's committed `output.css` and `output.tsx`.
 * - `size.libraries`: `packages/ui` (shadcn's components on Base UI) and `packages/docs-ui`,
 *   compiled module by module in one session, as a bundler would: the minified stylesheet, and the
 *   compiled modules concatenated.
 * - `size.runtime`: the private runtime, minified, as its hard limit measures it
 *   (`npm/core/test/internal.test.ts`).
 * - `types`: each project in `budgets/types/`, in types and instantiations above the `empty` one.
 *
 * The docs site's built stylesheet is printed when the site has been built, and never recorded:
 * it grows with the site's pages, not only with Kirana.
 *
 * Run it with Node: Bun's zlib compresses the same bytes to a different size.
 */
import { execFileSync } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { brotliCompressSync, constants, gzipSync } from "node:zlib"

/** Raw, gzip and brotli bytes. */
export type Size = { raw: number; gzip: number; brotli: number }

/** A stylesheet and its JavaScript. */
export type Output = { css: Size; js: Size }

export type Budgets = {
  size: {
    fixtures: { [name: string]: Output }
    libraries: { [name: string]: Output }
    runtime: Size
  }
  types: { [name: string]: { types: number; instantiations: number } }
}

/** One measure that differs from the record. */
export type Change = { measure: string; before?: number; after?: number }

const kirana = path.resolve(import.meta.dirname, "..")
const workspace = path.resolve(kirana, "../..")
const recordFile = path.join(kirana, "budgets/budgets.json")

export function size(text: string): Size {
  const bytes = Buffer.from(text)
  return {
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  }
}

function fixtures(): Budgets["size"]["fixtures"] {
  const directory = path.join(kirana, "fixtures/transform")
  const out: Budgets["size"]["fixtures"] = {}
  for (const name of readdirSync(directory).sort()) {
    const read = (file: string) => {
      const at = path.join(directory, name, file)
      return existsSync(at) ? readFileSync(at, "utf8") : ""
    }
    out[name] = { css: size(read("output.css")), js: size(read("output.tsx")) }
  }
  return out
}

async function library(root: string): Promise<Output> {
  const { Driver } = await import("@kirana-style/compiler")
  const driver = Driver.createSync({ root })
  const source = path.join(root, "src")
  const files = (readdirSync(source, { recursive: true }) as string[])
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"))
    .map((file) => file.replaceAll("\\", "/"))
    .sort()
  const modules = files.map(
    (file) =>
      driver.transform(
        path.join(source, file),
        readFileSync(path.join(source, file), "utf8")
      ).code ?? ""
  )
  return { css: size(driver.stylesheet(true)), js: size(modules.join("\n")) }
}

async function runtime(): Promise<Size> {
  const { minifySync } = await import("oxc-minify")
  const { transformSync } = await import("oxc-transform")
  const root = path.join(kirana, "npm/core/src")
  const families = readFileSync(
    path.join(root, "families.generated.ts"),
    "utf8"
  ).replaceAll("export ", "")
  const source = readFileSync(path.join(root, "internal.ts"), "utf8").replace(
    /import \{ FOUR, TWO \} from "\.\/families\.generated\.ts"\n/,
    families
  )
  return size(
    minifySync("internal.js", transformSync("internal.ts", source).code).code
  )
}

/** `Types:` and `Instantiations:` from `tsc --extendedDiagnostics`. */
export function counts(diagnostics: string): {
  types: number
  instantiations: number
} {
  const read = (label: string) => {
    const match = new RegExp(`^${label}:\\s+(\\d+)`, "m").exec(diagnostics)
    if (!match) throw new Error(`tsc printed no "${label}:" line`)
    return Number(match[1])
  }
  return { types: read("Types"), instantiations: read("Instantiations") }
}

function types(): Budgets["types"] {
  const directory = path.join(kirana, "budgets/types")
  const tsc = path.join(workspace, "node_modules/.bin/tsc")
  const check = (name: string) => {
    let output: string
    try {
      output = execFileSync(
        tsc,
        ["-p", path.join(directory, name), "--extendedDiagnostics"],
        {
          encoding: "utf8",
        }
      )
    } catch (error) {
      const failed = error as { stdout?: string }
      throw new Error(
        `budgets/types/${name} does not type-check:\n${failed.stdout ?? error}`
      )
    }
    return counts(output)
  }
  const floor = check("empty")
  const out: Budgets["types"] = {}
  for (const name of readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "empty")
    .map((entry) => entry.name)
    .sort()) {
    const counted = check(name)
    out[name] = {
      types: counted.types - floor.types,
      instantiations: counted.instantiations - floor.instantiations,
    }
  }
  return out
}

export async function measure(): Promise<Budgets> {
  return {
    size: {
      fixtures: fixtures(),
      libraries: {
        ui: await library(path.join(workspace, "packages/ui")),
        "docs-ui": await library(path.join(workspace, "packages/docs-ui")),
      },
      runtime: await runtime(),
    },
    types: types(),
  }
}

/** Every number, keyed by its path in the record (`size.fixtures.basic.css.gzip`). */
export function flatten(
  value: unknown,
  prefix = "",
  out = new Map<string, number>()
) {
  if (typeof value === "number") out.set(prefix, value)
  else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value))
      flatten(inner, prefix ? `${prefix}.${key}` : key, out)
  return out
}

export function compare(before: unknown, after: unknown): Change[] {
  const old = flatten(before)
  const next = flatten(after)
  const changes: Change[] = []
  for (const key of [...new Set([...old.keys(), ...next.keys()])].sort()) {
    if (old.get(key) !== next.get(key))
      changes.push({ measure: key, before: old.get(key), after: next.get(key) })
  }
  return changes
}

/** The changes as a Markdown table, with each one's difference and percentage. */
export function report(changes: Change[]): string {
  if (changes.length === 0) return "Budgets: no change.\n"
  const rows = changes.map(({ measure: key, before, after }) => {
    const delta =
      before === undefined || after === undefined
        ? before === undefined
          ? "new"
          : "removed"
        : `${after > before ? "+" : ""}${after - before}${
            before === 0
              ? ""
              : ` (${(((after - before) / before) * 100).toFixed(1)} %)`
          }`
    return `| \`${key}\` | ${before ?? "—"} | ${after ?? "—"} | ${delta} |`
  })
  return [
    `Budgets: ${changes.length} measure${changes.length === 1 ? "" : "s"} changed.`,
    "",
    "| Measure | Recorded | Now | Difference |",
    "| --- | ---: | ---: | ---: |",
    ...rows,
    "",
  ].join("\n")
}

/** The docs site's built stylesheets, when it has been built: printed, never recorded. */
function site(): string | undefined {
  const assets = path.join(workspace, "apps/docs/dist/client/assets")
  if (!existsSync(assets)) return undefined
  const css = readdirSync(assets)
    .filter((file) => file.endsWith(".css"))
    .sort()
    .map((file) => readFileSync(path.join(assets, file), "utf8"))
    .join("\n")
  const { raw, gzip, brotli } = size(css)
  return `The docs site's stylesheets (not recorded): ${raw} B, ${gzip} B gzip, ${brotli} B brotli.\n`
}

export async function main(args: readonly string[]): Promise<number> {
  const now = await measure()
  const text = `${JSON.stringify(now, null, 2)}\n`
  if (args.includes("--update")) {
    writeFileSync(recordFile, text)
    console.log(`Wrote ${path.relative(workspace, recordFile)}.`)
    return 0
  }
  const recorded: unknown = existsSync(recordFile)
    ? JSON.parse(readFileSync(recordFile, "utf8"))
    : {}
  const changes = compare(recorded, now)
  const output = report(changes) + (site() ?? "")
  console.log(output)
  if (args.includes("--summary") && process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Budgets\n\n${output}\n`)
  if (args.includes("--check") && changes.length > 0) {
    console.error(
      "The budgets record is out of date. Run `bun run budgets --update` in packages/kirana, and commit budgets/budgets.json with the change that caused it."
    )
    return 1
  }
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = await main(process.argv.slice(2))
