/**
 * Fails when the site says something about Kirana that its source of truth does not
 * (CONSISTENCY.md). It reads the pages, the site's components and the packages' READMEs, and checks
 * them against `src/data/facts.ts` and the generated data behind it:
 *
 *   counts        a number of diagnostics, lint rules or packages written by hand
 *   lists         a sentence naming most frameworks, bundlers or linters, but not all of them
 *   agents        a sentence offering agents llms.txt without the skills
 *   logos         a product named in a heading next to a generic icon instead of its logo
 *   lint rules    a rule missing from the lint page, the site's rule cards, the spec or a README
 *   commands      a `kirana` command missing from the CLI page or the spec
 *
 * A passage that records history (a sprint) is exempt when the line before it is
 * `<!-- consistency: history -->`, and a list that is a deliberate subset (the frameworks with
 * single-file components) when it is `<!-- consistency: subset -->` — in a component, a
 * `// consistency: subset` comment on the line before the string. A file that records history, or
 * whose subject is one of the things checked, is exempted below with the reason.
 *
 *   bun scripts/check-consistency.ts
 */
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

import { COMMANDS } from "../src/generated/cli.gen.ts"
import { LINT } from "../src/generated/lint.gen.ts"
import { COUNTS, LISTS } from "../src/data/facts.ts"
import { LINT_RULES } from "../src/data/tooling.ts"

const app = new URL("..", import.meta.url).pathname
const repository = join(app, "../..")

/** Files that record what was true when they were written, or are about one item checked here. */
const HISTORY = new Set([
  // Dated entries: what shipped then.
  "apps/docs/src/data/changelog.ts",
  "apps/docs/content/blog",
  // The page about llms.txt itself; it links the skills.
  "apps/docs/content/docs/project/llms.md",
])

/** Brand names a heading may carry, with the logo key the site has for them. */
const BRANDS = [
  "Tailwind CSS",
  "Tailwind",
  "StyleX",
  "Panda CSS",
  "Panda",
  "Biome",
  "ESLint",
  "Oxlint",
  "Vite",
  "Next.js",
  "React",
  "Vue",
  "Svelte",
  "Astro",
  "Angular",
  "Qwik",
  "VS Code",
  "Zed",
  "Laravel",
  "Rails",
  "Phoenix",
  "Symfony",
]

const problems: string[] = []
const report = (file: string, line: number, message: string) =>
  problems.push(`${file}:${line}: ${message}`)

async function files(directory: string, pattern: RegExp): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (["generated", "node_modules", "dist"].includes(entry.name)) continue
      out.push(...(await files(path, pattern)))
    } else if (pattern.test(entry.name)) out.push(path)
  }
  return out
}

const lineOf = (text: string, index: number) =>
  text.slice(0, index).split("\n").length

/**
 * The prose of a file, as sentences with their line: markdown outside code blocks, or the string
 * literals of a component. A sentence after a history marker is left out.
 */
function sentences(
  path: string,
  text: string
): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = []
  if (path.endsWith(".md")) {
    const lines = text.split("\n")
    let fenced = false
    // A marker covers the next block — a paragraph, a list or a table — however many blank lines
    // the formatter puts between them.
    let marked = false
    let history = false
    let paragraph: { text: string; line: number } | undefined
    const flush = () => {
      if (paragraph && !history)
        for (const part of paragraph.text.split(/(?<=[.!?])\s+(?=[A-Z`*[])/))
          out.push({ text: part, line: paragraph.line })
      paragraph = undefined
    }
    lines.forEach((line, index) => {
      if (line.startsWith("```")) {
        fenced = !fenced
        return
      }
      if (fenced) return
      if (
        /^<!--\s*consistency:\s*(history|subset|ignore)\b[^>]*-->$/.test(
          line.trim()
        )
      ) {
        flush()
        marked = true
        return
      }
      if (line.trim() === "" || /^#{1,6} /.test(line)) {
        flush()
        if (!marked) history = false
        return
      }
      if (marked) {
        history = true
        marked = false
      }
      if (/^(- |\d+\. |\| )/.test(line)) flush()
      if (paragraph) paragraph.text += ` ${line.trim()}`
      else paragraph = { text: line.trim(), line: index + 1 }
    })
    flush()
    return out
  }
  const lines = text.split("\n")
  for (const match of text.matchAll(
    /"((?:[^"\\\n]|\\.){12,})"|`([^`]{12,})`/g
  )) {
    const body = match[1] ?? match[2]!
    if (/^[@./\w-]+$/.test(body)) continue
    const at = lineOf(text, match.index ?? 0)
    if (/consistency:\s*(subset|history|ignore)/.test(lines[at - 2] ?? ""))
      continue
    out.push({ text: body, line: lineOf(text, match.index ?? 0) })
  }
  return out
}

const NUMBER =
  "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
const COUNTED = new RegExp(
  `\\b${NUMBER}\\s+(diagnostics|diagnostic codes|codes with stable|(?:lint |Kirana |more |new )?rules|packages|commands|framework guides)\\b`,
  "gi"
)
const HEDGED =
  /\b(and more|among them|for example|such as|e\.g\.|including|like)\b/i

/** How many of `names` a sentence names, as whole words. */
const named = (text: string, names: readonly string[]) =>
  names.filter((name) =>
    new RegExp(
      `(^|[^\\w.-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`
    ).test(text)
  )

function checkProse(path: string, text: string) {
  for (const { text: sentence, line } of sentences(path, text)) {
    if (/consistency:\s*(subset|history|ignore)/.test(sentence)) continue
    for (const count of sentence.matchAll(COUNTED))
      report(
        path,
        line,
        `"${count[0]}" is written by hand; use {{fact:…}} in markdown or COUNTS in a component`
      )
    for (const [kind, fact, all] of [
      ["frameworks", "frameworks", LISTS.frameworks],
      ["component layers", "libraries", LISTS.libraries],
      ["server frameworks", "server-frameworks", LISTS.serverFrameworks],
      ["bundlers", "bundlers", LISTS.bundlers],
      ["exports of @kirana-style/core", "api", LISTS.api],
    ] as const) {
      const found = named(sentence, all)
      // Half or more of a group reads as the whole group; fewer is an example.
      if (
        found.length >= Math.max(3, Math.ceil(all.length / 2)) &&
        found.length < all.length &&
        !HEDGED.test(sentence)
      )
        report(
          path,
          line,
          `names ${found.length} of ${all.length} ${kind} (missing ${all.filter((name) => !found.includes(name)).join(", ")}); name them all ({{fact:${fact}}}), say "and more", or mark a deliberate subset`
        )
    }
    const linters = named(sentence, LISTS.linters)
    if (
      linters.length >= 2 &&
      linters.length < LISTS.linters.length &&
      !/eslint-plugin|jsPlugins/i.test(sentence)
    )
      report(
        path,
        line,
        `names ${linters.join(" and ")} without ${LISTS.linters.filter((name) => !linters.includes(name)).join(", ")}; Kirana's rules run under ${LISTS.linters.join(", ")}; name all, or mark a deliberate subset`
      )
    if (
      /llms\.txt/.test(sentence) &&
      /\b(agents?|AI|language models?|LLMs?)\b(?![.-])/i.test(sentence) &&
      !/skill/i.test(sentence)
    )
      report(path, line, "offers agents llms.txt without the agent skills")
  }
}

/** A hugeicon beside a brand's name in a heading: the brand's logo belongs there. */
function checkLogos(path: string, text: string) {
  const brands = BRANDS.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")
  for (const match of text.matchAll(
    /<(Keycap|Icon|Tile)\s+icon=\{(\w+Icon)\}[^>]*\/>/g
  )) {
    const after = text.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 220
    )
    const brand = new RegExp(
      `>\\s*((?:From |For )?(?:${brands}))\\b[^<]{0,24}<`
    ).exec(after)
    if (brand)
      report(
        path,
        lineOf(text, match.index ?? 0),
        `"${brand[1]}" is drawn with ${match[2]}; use its logo (SVGL / BrandIcon)`
      )
  }
  for (const match of text.matchAll(
    /\{[^{}]*?\bicon:\s*(\w+Icon)\b[^{}]*?\}/gs
  )) {
    const block = match[0]
    const title = new RegExp(
      `\\b(title|label|name):\\s*"((?:From |For )?(?:${brands}))\\b`
    ).exec(block)
    if (title && !/\b(logo|brand)\b/.test(block))
      report(
        path,
        lineOf(text, match.index ?? 0),
        `"${title[2]}" has the icon ${match[1]} and no logo`
      )
  }
}

const relativePath = (path: string) => relative(repository, path)
const exempt = (path: string) =>
  [...HISTORY].some((prefix) => relativePath(path).startsWith(prefix))

for (const path of [
  ...(await files(join(app, "content"), /\.md$/)),
  ...(await files(join(app, "src"), /\.tsx?$/)),
  ...(await files(join(repository, "packages/kirana/npm"), /^README\.md$/)),
  join(repository, "README.md"),
]) {
  if (exempt(path) || path.endsWith("facts.ts")) continue
  const text = await readFile(path, "utf8")
  checkProse(relativePath(path), text)
  if (path.endsWith(".tsx")) checkLogos(relativePath(path), text)
}

/** Every lint rule, everywhere rules are listed. */
const rules = LINT.map((rule) => rule.name).sort()
const lists: [string, string[]][] = [
  [
    "apps/docs/src/data/tooling.ts (LINT_RULES)",
    LINT_RULES.map((rule) => rule.name),
  ],
]
const lintPage = await readFile(
  join(app, "content/docs/tooling/lint.md"),
  "utf8"
)
lists.push([
  "apps/docs/content/docs/tooling/lint.md (### headings)",
  [...lintPage.matchAll(/^### `([\w-]+)`/gm)].map((match) => match[1]!),
])
for (const file of [
  "spec/12-tooling-and-dx.md",
  "packages/kirana/npm/eslint-plugin/README.md",
]) {
  const text = await readFile(join(repository, file), "utf8")
  lists.push([
    file,
    [
      ...new Set(
        [...text.matchAll(/^\| `(?:kirana\/)?([\w-]+)`\s+\|/gm)].map(
          (match) => match[1]!
        )
      ),
    ].filter((name) => !name.startsWith("kirana")),
  ])
}
for (const [where, names] of lists) {
  const missing = rules.filter((rule) => !names.includes(rule))
  const extra = names.filter((name) => !rules.includes(name))
  if (missing.length || extra.length)
    problems.push(
      `${where}: lint rules ${missing.length ? `missing ${missing.join(", ")}` : ""}${extra.length ? ` unknown ${extra.join(", ")}` : ""}`
    )
}
const biomeReadme = await readFile(
  join(repository, "packages/kirana/npm/biome-plugin/README.md"),
  "utf8"
)
const biomeListed = [
  ...biomeReadme.matchAll(/^\| `([\w-]+)`\s+\| (recommended|strict)/gm),
]
  .map((match) => match[1]!)
  .sort()
if (biomeListed.join() !== [...LISTS.biomeRules].sort().join())
  problems.push(
    `packages/kirana/npm/biome-plugin/README.md: lists ${biomeListed.join(", ")}; the plugin has ${LISTS.biomeRules.join(", ")}`
  )

/** Every command, on the CLI page and in the spec. */
const cliPage = await readFile(join(app, "content/docs/tooling/cli.md"), "utf8")
const spec = await readFile(
  join(repository, "spec/12-tooling-and-dx.md"),
  "utf8"
)
for (const command of COMMANDS) {
  if (!new RegExp(`^## \`kirana ${command}`, "m").test(cliPage))
    problems.push(
      `apps/docs/content/docs/tooling/cli.md: no section for kirana ${command}`
    )
  if (!new RegExp(`\\| \`kirana ${command}\\b`).test(spec))
    problems.push(
      `spec/12-tooling-and-dx.md: kirana ${command} is not in the CLI table`
    )
}
const described = /^description: (.*)$/m.exec(cliPage)?.[1] ?? ""
for (const command of COMMANDS)
  if (!new RegExp(`\\b${command}\\b`).test(described))
    problems.push(
      `apps/docs/content/docs/tooling/cli.md: the description leaves out ${command}`
    )

if (problems.length) {
  console.error(problems.join("\n"))
  console.error(
    `\n${problems.length} inconsistencies; see apps/docs/CONSISTENCY.md`
  )
  process.exit(1)
}
console.log(
  `consistency: ${COUNTS.diagnostics} diagnostics, ${COUNTS.lintRules} lint rules, ${COUNTS.packages} packages, ${COMMANDS.length} commands agree everywhere`
)
