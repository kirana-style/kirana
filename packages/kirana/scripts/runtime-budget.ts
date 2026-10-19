/**
 * Where the private runtime's 1,100 bytes go (KRN-DYN-005).
 *
 *   bun scripts/runtime-budget.ts
 *
 * The budget is a hard test (`npm/core/test/internal.test.ts`), so the useful question is not
 * whether it passes but what is left and what could be given back. Each part is removed on its own
 * and the module re-minified: the difference is what that part costs, including whatever else the
 * minifier can then drop, which is why the numbers do not add up to the whole.
 *
 * Run it with Node, as `bun run budget` does, because the test measures with Node's zlib. Bun's
 * gives a different number for the same bytes — 1,003 against 999 at the time of writing — and only
 * one of them can be the budget.
 */
import { readFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { minifySync } from "oxc-minify"
import { transformSync } from "oxc-transform"

const root = new URL("../npm/core/src/", import.meta.url)
const families = readFileSync(
  new URL("families.generated.ts", root),
  "utf8"
).replaceAll("export ", "")
const source = readFileSync(new URL("internal.ts", root), "utf8").replace(
  /import \{ FOUR, TWO \} from "\.\/families\.generated\.ts"\n/,
  families
)

const compile = (text: string) =>
  minifySync("internal.js", transformSync("internal.ts", text).code).code
const size = (text: string) => gzipSync(compile(text)).length

/** The text between two markers, so a part can be removed without a fragile pattern. */
function between(from: string, to: string): string | undefined {
  const start = source.indexOf(from)
  const end = source.indexOf(to, start)
  return start < 0 || end < 0 ? undefined : source.slice(start, end)
}

const whole = size(source)
console.log(
  `runtime: ${compile(source).length} B minified, ${whole} B gzip of 1100, ${1100 - whole} to spare\n`
)

const parts: [string, string | undefined][] = [
  ["recipe()", between("  const recipe", "\n  return {")],
  ["the bridge b()", between("  const b = (", "  const recipe")],
  ["cx() and sx()", between("  const cx = (", "  const b = (")],
  ["the merge core", between("  const add = (", "  const merge = (")],
]
for (const [name, text] of parts) {
  if (text === undefined) {
    console.log(`${name.padEnd(16)} (not found — the source moved)`)
    continue
  }
  console.log(
    `${name.padEnd(16)} ${String(whole - size(source.replace(text, ""))).padStart(4)} B gzip`
  )
}
