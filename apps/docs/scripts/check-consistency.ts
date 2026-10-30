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
 *   commands      a `kirana-style` command missing from the CLI page or the spec
 *   ideas         a number of mental-model ideas other than the page's own
 *   runtime size  the runtime's size written by hand instead of {{fact:runtime-size}}
 *   benchmarks    a measured claim written by hand ("2.9× faster", "within 3 % of", "the smallest
 *                 CSS") instead of {{fact:bench-…}} or CLAIMS, which kirana-lab's run words
 *   style         an em dash in prose or site copy (code is exempt); a paragraph or list item with
 *                 more than four inline code spans, which reads better as a list, a table or a
 *                 code block; a description written as metadata ("X - y"), since it is the lede
 *   npm           "not on npm" anywhere once the packages are published
 *   command name  the command written as `kirana <command>`, or run as `npx kirana`, `bunx
 *                 kirana` and the like: it is `kirana-style` (D-082), since npm does not give out
 *                 the name `kirana`, and a runner would fetch whatever has it
 *   links         a `/docs/<page>#<heading>` link to a page or heading that does not exist
 *   colours       a scales colour written flat (`color.zinc500`)
 *   entry points  an export of `@kirana-style/core` missing from the API page's table
 *   config        a key `kirana_config` reads missing from the configuration page
 *   editors       an editor window's hint the formatter moved onto a line of its own
 *   groups        a package in no group of `/ecosystem`'s cards, or in two
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
import { PACKAGES } from "../src/generated/packages.gen.ts"
import { COUNTS, LISTS, PUBLISHED } from "../src/data/facts.ts"
import { LINT_RULES } from "../src/data/tooling.ts"
import { SCENES } from "../src/brand/scenes.ts"
import type { SceneId } from "../src/brand/scenes.ts"

const app = new URL("..", import.meta.url).pathname
const repository = join(app, "../..")

/** Files that record what was true when they were written, or are about one item checked here. */
const HISTORY = new Set([
  // Dated entries: what shipped then.
  "apps/docs/src/data/changelog.ts",
  "apps/docs/content/blog",
  // The page about llms.txt itself; it links the skills.
  "apps/docs/content/docs/project/llms.md",
  // The "not on npm yet" note itself, which no page shows once the packages are published.
  "apps/docs/src/data/npm-status.ts",
  // Where the measured claims are worded; its comments show what the words look like.
  "apps/docs/src/data/benchmarks.ts",
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
  for (const { body, index } of literals(text)) {
    if (body.length < 12 || /^[@./\w-]+$/.test(body)) continue
    const at = lineOf(text, index)
    if (/consistency:\s*(subset|history|ignore)/.test(lines[at - 2] ?? ""))
      continue
    out.push({ text: body, line: at })
  }
  return out
}

/**
 * The string literals of a script, read left to right with its comments, so a backtick or a quote
 * in a comment never opens a string. A template keeps its `${…}` as written, so its sentence stays
 * whole; the strings inside a substitution are literals of their own. Regular expressions are
 * skipped. JSX text is read as code, which is safe for the prose it holds: an apostrophe after a
 * letter opens nothing, `//` after a colon is a URL, and a quote that does not close on its line
 * is skipped.
 */
function literals(text: string): { body: string; index: number }[] {
  const out: { body: string; index: number }[] = []
  // The open templates whose substitution is being read, with the brace depth it started at.
  const templates: { body: string; index: number; depth: number }[] = []
  let depth = 0
  // The last character outside whitespace and comments, which tells a regex from a division.
  let previous = ""
  let at = 0
  const template = (body: string, index: number) => {
    for (; at < text.length; at++) {
      const char = text[at]!
      if (char === "\\") body += char + (text[++at] ?? "")
      else if (char === "`") break
      else if (char === "$" && text[at + 1] === "{") {
        at += 2
        templates.push({ body: `${body}\${`, index, depth: depth++ })
        return
      } else body += char
    }
    at++
    out.push({ body, index })
    previous = "`"
  }
  while (at < text.length) {
    const char = text[at]!
    const next = text[at + 1]
    if (/\s/.test(char)) at++
    else if (char === "/" && next === "/" && text[at - 1] !== ":") {
      const end = text.indexOf("\n", at)
      at = end === -1 ? text.length : end
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", at + 2)
      at = end === -1 ? text.length : end + 2
    } else if (
      char === '"' ||
      (char === "'" && !/[\p{L}\p{N}]/u.test(text[at - 1] ?? ""))
    ) {
      const quoted = new RegExp(
        `${char}((?:[^${char}\\\\\\n]|\\\\.)*)${char}`,
        "y"
      )
      quoted.lastIndex = at
      const found = quoted.exec(text)
      if (found) {
        out.push({ body: found[1]!, index: at })
        at = quoted.lastIndex
        previous = char
      } else at++
    } else if (char === "`") {
      at++
      template("", at - 1)
    } else if (
      char === "/" &&
      (previous === "" || /[(,=:[!&|?{};+\-*%~^>]/.test(previous))
    ) {
      // A regular expression, up to its closing slash on the same line.
      const regex = /\/(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[a-z]*/y
      regex.lastIndex = at
      at = regex.exec(text) ? regex.lastIndex : at + 1
      previous = "/"
    } else {
      at++
      if (char === "{") depth++
      else if (char === "}" && templates.at(-1)?.depth === --depth) {
        const { body, index } = templates.pop()!
        template(`${body}}`, index)
        continue
      }
      previous = char
    }
  }
  return out
}

const NUMBER =
  "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
const COUNTED = new RegExp(
  `\\b${NUMBER}\\s+(diagnostics|diagnostic codes|codes with stable|checks with codes|(?:lint |Kirana |more |new )?rules|packages|commands|framework guides|platforms|agent skills|milestones)\\b`,
  "gi"
)

/** The mental model's ideas: its numbered headings (`## 1 · …`). */
const IDEAS = (
  await readFile(join(app, "content/docs/start/mental-model.md"), "utf8")
).match(/^## \d+ · /gm)!.length
const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
]
const IDEA_COUNT = new RegExp(`\\b${NUMBER}\\s+ideas\\b`, "gi")

/** The runtime's size, which `{{fact:runtime-size}}` and RUNTIME_SIZE carry. */
const RUNTIME_SIZE =
  /\b\d+(?:\.\d+)?\s?kB\s+(?:runtime|gzip|minified)|(?:under|<)\s?\d+(?:\.\d+)?\s?kB\b/i

/**
 * A measured claim: a multiple or a percentage, or "the smallest CSS", in a sentence that compares
 * with StyleX or Tailwind. A figure quoted from someone else's measurement names no such tool.
 */
const COMPARED = /\b(?:StyleX|Tailwind)\b/
const BENCHMARK =
  /\b\d+(?:\.\d+)?\s?(?:×|%)\s+(?:faster|slower|smaller|larger|less|more)\b|\bwithin\s+\d+(?:\.\d+)?\s?%\s+of\b|\bsmallest\s+(?:\w+\s+)?CSS\b/i

/** What the pages say while the packages are unpublished; wrong once they are on npm. */
const UNPUBLISHED =
  /\bnot (?:yet )?(?:on|published to) npm\b|\bnot (?:yet )?published\b|\buntil the packages are (?:on npm|published)\b/i
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
    for (const count of sentence.matchAll(IDEA_COUNT)) {
      const said = /^\d+$/.test(count[1]!)
        ? Number(count[1])
        : WORDS.indexOf(count[1]!.toLowerCase())
      if (said !== IDEAS)
        report(
          path,
          line,
          `"${count[0]}": the mental model has ${IDEAS} ideas (its numbered headings)`
        )
    }
    if (RUNTIME_SIZE.test(sentence))
      report(
        path,
        line,
        "the runtime's size is written by hand; use {{fact:runtime-size}} in markdown or RUNTIME_SIZE in a component"
      )
    if (COMPARED.test(sentence) && BENCHMARK.test(sentence))
      report(
        path,
        line,
        "a measured claim is written by hand; use {{fact:bench-…}} in markdown or CLAIMS from data/benchmarks.ts in a component"
      )
    if (PUBLISHED && UNPUBLISHED.test(sentence))
      report(
        path,
        line,
        "the packages are published (PUBLISHED in facts.ts), but this says they are not"
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

/** More inline code than this in one paragraph or list item reads as code, not prose. */
const MAX_CODE_SPANS = 4

/**
 * How the docs are written: no em dash outside code, no paragraph that is mostly inline code, and a
 * description that reads as the page's first sentence. Unlike the fact checks, these hold for dated
 * pages too: a blog post is history, its punctuation is not.
 */
function checkStyle(path: string, text: string) {
  // The READMEs and the contributor's guide are about the repository, where a paragraph of paths
  // and commands is the point: they keep the em-dash rule and skip density.
  const dense = path.startsWith("apps/docs/")
  if (path.endsWith(".md")) {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text)
    const description = front && /^description:\s*(.*)$/m.exec(front[1]!)
    if (description && /\s-\s|—/.test(description[1]!))
      report(
        path,
        lineOf(text, (front!.index ?? 0) + front![0].indexOf(description[0])),
        'the description is the page\'s lede: write it as a sentence, without " - " or a dash'
      )
    const lines = text.split("\n")
    let fenced = false
    let block: { text: string; line: number } | undefined
    const flush = () => {
      if (block) {
        const spans = block.text.match(/`[^`\n]+`/g)?.length ?? 0
        if (dense && spans > MAX_CODE_SPANS)
          report(
            path,
            block.line,
            `${spans} inline code spans in one paragraph; make it a list, a table or a code block`
          )
      }
      block = undefined
    }
    lines.forEach((line, index) => {
      if (index < (front ? front[0].split("\n").length - 1 : 0)) return
      if (line.startsWith("```")) {
        flush()
        fenced = !fenced
        return
      }
      if (fenced) return
      if (line.replace(/`[^`\n]*`/g, "").includes("—"))
        report(
          path,
          index + 1,
          "an em dash in prose; use a comma, a colon, brackets or a full stop"
        )
      const trimmed = line.trim()
      if (trimmed === "" || /^(#{1,6} |\||<!--)/.test(trimmed)) return flush()
      if (/^(- |\* |\d+\. )/.test(trimmed)) flush()
      if (block) block.text += ` ${trimmed}`
      else block = { text: trimmed, line: index + 1 }
    })
    flush()
    return
  }
  // A component: its strings and JSX text, not its comments.
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim()
    if (/^(\/\/|\*|\/\*|\{\/\*)/.test(trimmed)) return
    const comment = line.search(/\s\/\/\s/)
    const dash = line.indexOf("—")
    if (dash !== -1 && (comment === -1 || dash < comment))
      report(
        path,
        index + 1,
        "an em dash in site copy; use a comma, a colon, brackets or a full stop"
      )
  })
}

/** A subcommand of the CLI, after a name that is not the command's. */
const SUBCOMMAND =
  "(?:init|doctor|dev|build|check|analyze|export|trace|migrate|lsp|report)\\b"

/**
 * The command under its old name: `kirana <command>`, or a runner (`npx`, `bunx`, `pnpm dlx`,
 * `yarn dlx`) given a bare `kirana`. The command is `kirana-style` (D-082). Commands live in code
 * blocks, which the prose checks skip, so this reads the raw text.
 */
function checkCommandName(path: string, text: string) {
  const stale = new RegExp(
    `\\b(?:npx|bunx|pnpx|pnpm dlx|yarn dlx) kirana(?:@\\S+)?(?= )|(?<![\\w@/.-])kirana (?=${SUBCOMMAND})`,
    "g"
  )
  for (const match of text.matchAll(stale))
    report(
      path,
      lineOf(text, match.index ?? 0),
      `\`${match[0].trim()}\`: the command is \`kirana-style\` (D-082); npm does not give out \`kirana\``
    )
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
  const text = await readFile(path, "utf8")
  checkStyle(relativePath(path), text)
  if (exempt(path) || path.endsWith("facts.ts")) continue
  checkProse(relativePath(path), text)
  if (path.endsWith(".tsx")) checkLogos(relativePath(path), text)
  checkCommandName(relativePath(path), text)
}
// The contributor's guide is read on GitHub; it keeps the em-dash rule too.
checkStyle(
  "CONTRIBUTING.md",
  await readFile(join(repository, "CONTRIBUTING.md"), "utf8")
)
// The homepage's and the Quick start's terminal snippets, and the agent skills, outside src and
// content.
for (const path of [
  ...(await files(join(app, "showcase"), /\.txt$/)),
  ...(await files(join(repository, "skills"), /\.md$/)),
])
  checkCommandName(relativePath(path), await readFile(path, "utf8"))
// The examples' commands, which the runner starts as JSON arrays (`["kirana-style", "dev", …]`):
// each array is read as the command line it starts. Its scripts are plain strings, read as they are.
for (const path of await files(
  join(repository, "packages/kirana/examples"),
  /^package\.json$/
)) {
  if (path.includes("node_modules")) continue
  const commands: string[] = []
  const walk = (value: unknown): void => {
    if (Array.isArray(value) && value.every((part) => typeof part === "string"))
      commands.push(value.join(" "))
    else if (Array.isArray(value)) value.forEach(walk)
    else if (typeof value === "string") commands.push(value)
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk)
  }
  const manifest = JSON.parse(await readFile(path, "utf8")) as Record<
    string,
    unknown
  >
  walk([manifest.scripts, manifest["kirana-example"]])
  checkCommandName(relativePath(path), commands.join("\n"))
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
  ...biomeReadme.matchAll(/^\| `([\w-]+)`\s+\| (recommended|strict|neither)/gm),
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
  if (!new RegExp(`^## \`kirana-style ${command}`, "m").test(cliPage))
    problems.push(
      `apps/docs/content/docs/tooling/cli.md: no section for kirana-style ${command}`
    )
  if (!new RegExp(`\\| \`kirana-style ${command}\\b`).test(spec))
    problems.push(
      `spec/12-tooling-and-dx.md: kirana-style ${command} is not in the CLI table`
    )
}
const described = /^description: (.*)$/m.exec(cliPage)?.[1] ?? ""
for (const command of COMMANDS)
  if (!new RegExp(`\\b${command}\\b`).test(described))
    problems.push(
      `apps/docs/content/docs/tooling/cli.md: the description leaves out ${command}`
    )

/**
 * A menu item's scene is its page's: the item's icon wears the hue of the page it leads to. A
 * route's page names its scene (`<Page scene>`); a docs page takes its tab's hue (`TABS`).
 */
const nav = await readFile(join(app, "src/components/site/nav.ts"), "utf8")
const docsConfig = await readFile(
  join(app, "src/components/docs-config.tsx"),
  "utf8"
)
const tabHue = new Map<string, string>()
for (const [, sections, hue] of docsConfig.matchAll(
  /sections: \[([^\]]*)\],\s*accent: "(\w+)"/g
))
  for (const [, section] of sections!.matchAll(/"(\w+)"/g))
    tabHue.set(section!, hue!)
for (const [, title, href, scene] of nav.matchAll(
  /title: "([^"]+)",\s*description: "[^"]*",\s*href: "([^"]+)",\s*icon: \w+,\s*scene: "([\w-]+)"/g
)) {
  const hue = SCENES[scene as SceneId]?.hue
  if (href!.startsWith("/docs")) {
    const section = href!.split("/")[2] ?? "start"
    const expected = tabHue.get(section) ?? tabHue.get("start")
    if (hue !== expected)
      problems.push(
        `apps/docs/src/components/site/nav.ts: "${title}" wears ${hue}, but ${href} is in a tab of ${expected}`
      )
    continue
  }
  const route = href === "/" ? "index" : href!.slice(1).replaceAll("/", ".")
  const page = await readFile(
    join(app, "src/routes", `${route}.tsx`),
    "utf8"
  ).catch(() => readFile(join(app, "src/routes", `${route}.index.tsx`), "utf8"))
  const own = /<Page scene="([\w-]+)"/.exec(page)?.[1]
  if (own !== scene)
    problems.push(
      `apps/docs/src/components/site/nav.ts: "${title}" is in ${scene}, but ${href} stands in ${own}`
    )
}

/**
 * Every `/docs/<page>#<heading>` link names a page and a heading it has: a renamed heading breaks
 * its links without a build error.
 */
const pagesDir = join(app, "src/generated/pages")
const headings = new Map<string, Set<string>>()
for (const path of await files(pagesDir, /\.json$/)) {
  const page = JSON.parse(await readFile(path, "utf8")) as {
    headings?: { id: string }[]
  }
  const slug = relative(pagesDir, path)
    .replace(/\.json$/, "")
    .replace(/(^|\/)index$/, "")
  headings.set(slug, new Set((page.headings ?? []).map(({ id }) => id)))
}
for (const path of [
  ...(await files(join(app, "content"), /\.md$/)),
  ...(await files(join(app, "src"), /\.tsx?$/)),
]) {
  if (path.includes("/generated/")) continue
  const text = await readFile(path, "utf8")
  for (const match of text.matchAll(
    /\/docs\/([a-z0-9/-]+?)(?:\.md)?#([\w-]+)/g
  )) {
    const ids = headings.get(match[1]!)
    if (!ids || !ids.has(match[2]!))
      report(
        relativePath(path),
        lineOf(text, match.index ?? 0),
        ids
          ? `/docs/${match[1]}#${match[2]}: the page has no such heading`
          : `/docs/${match[1]}: no such page`
      )
  }
}

/** The scales preset nests colours by hue: `color.zinc[500]`, never `color.zinc500`. */
for (const path of [
  ...(await files(join(app, "content"), /\.md$/)),
  ...(await files(join(repository, "skills"), /\.md$/)),
]) {
  const text = await readFile(path, "utf8")
  for (const match of text.matchAll(/\bcolor\.([a-z]+)(\d{2,3})\b/g))
    report(
      relativePath(path),
      lineOf(text, match.index ?? 0),
      `\`${match[0]}\`: the preset's colours are nested by hue, \`color.${match[1]}[${match[2]}]\``
    )
}

/** Every entry point of `@kirana-style/core` is in the API reference's table. */
const apiPage = await readFile(
  join(app, "content/docs/reference/api.md"),
  "utf8"
)
const entryPoints = apiPage.slice(
  apiPage.indexOf("## Entry points"),
  apiPage.indexOf("\n## ", apiPage.indexOf("## Entry points") + 1)
)
const coreExports = Object.keys(
  (
    JSON.parse(
      await readFile(
        join(repository, "packages/kirana/npm/core/package.json"),
        "utf8"
      )
    ) as { exports: Record<string, unknown> }
  ).exports
).filter((path) => path !== "./package.json")
for (const path of coreExports) {
  const listed =
    path === "."
      ? entryPoints.includes("`@kirana-style/core`")
      : new RegExp(`\`(@kirana-style/core)?${path.slice(1)}\``).test(
          entryPoints
        )
  if (!listed)
    report(
      "apps/docs/content/docs/reference/api.md",
      lineOf(apiPage, apiPage.indexOf("## Entry points")),
      `@kirana-style/core${path.slice(1)} is an entry point the table does not list`
    )
}

/**
 * Every key `kirana_config` reads is on the configuration page: a top-level key has a heading of
 * its own, a nested one is named in its parent's section.
 */
const configSource = await readFile(
  join(repository, "packages/kirana/crates/kirana_config/src/lib.rs"),
  "utf8"
)
const configPage = await readFile(
  join(app, "content/docs/reference/config.md"),
  "utf8"
)
function configFields(struct: string): { name: string; type: string }[] {
  const match = new RegExp(
    `((?:#\\[[^\\n]*\\]\\n)*)pub struct ${struct} \\{([\\s\\S]*?)\\n\\}`
  ).exec(configSource)
  if (!match) return []
  const camel = match[1]!.includes("camelCase")
  return [
    ...match[2]!.matchAll(/((?:\s*#\[[^\n]*\]\n)*)\s*pub (\w+): ([^,\n]+),/g),
  ].map(([, attributes, field, type]) => ({
    name:
      /rename = "(\w+)"/.exec(attributes!)?.[1] ??
      (camel
        ? field!.replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase())
        : field!),
    type: type!.replace(/^Option<(.*)>$/, "$1"),
  }))
}
const configFieldsTop = configFields("Config")
if (configFieldsTop.length < 5)
  throw new Error("check-consistency: kirana_config's Config was not found")
for (const { name, type } of configFieldsTop) {
  const heading = configPage.indexOf(`## \`${name}`)
  if (heading < 0) {
    report(
      "apps/docs/content/docs/reference/config.md",
      1,
      `\`${name}\`: a configuration key with no section`
    )
    continue
  }
  const end = configPage.indexOf("\n## ", heading + 1)
  const section = configPage.slice(heading, end < 0 ? undefined : end)
  for (const field of configFields(type))
    if (
      !configPage.includes(`\`${name}.${field.name}`) &&
      !new RegExp(`(\`${field.name}\`|\\b${field.name}\\??:)`).test(section)
    )
      report(
        "apps/docs/content/docs/reference/config.md",
        lineOf(configPage, heading),
        `\`${name}.${field.name}\`: a configuration key the page does not name`
      )
}

/**
 * An editor window's hints sit on their element's line (`<a> //: …`). The formatter moves one onto a
 * line of its own, after a `{" "}`, unless the block has `<!-- prettier-ignore -->` before it.
 */
for (const path of await files(join(app, "content"), /\.md$/)) {
  const text = await readFile(path, "utf8")
  for (const match of text.matchAll(/^```tsx editor[^\n]*\n([\s\S]*?)^```/gm)) {
    const start = lineOf(text, match.index ?? 0)
    match[1]!.split("\n").forEach((line, index) => {
      if (/^\s*(\/\/:|\{" "\}\s*$)/.test(line))
        report(
          relativePath(path),
          start + 1 + index,
          "an editor hint on a line of its own: put it back on its element's line and add <!-- prettier-ignore --> before the block"
        )
    })
  }
}

/** Every package is in one group of `/ecosystem`'s package cards, and only one. */
const packageCards = await readFile(
  join(app, "src/components/site/packages.tsx"),
  "utf8"
)
const grouped = [
  ...packageCards
    .slice(
      packageCards.indexOf("const GROUPS"),
      packageCards.indexOf("const styles")
    )
    .matchAll(/packages: \[([^\]]*)\]/g),
].flatMap((match) =>
  [...match[1]!.matchAll(/"([^"]+)"/g)].map((name) => name[1]!)
)
for (const { name } of PACKAGES) {
  const times = grouped.filter((listed) => listed === name).length
  if (times !== 1)
    report(
      "apps/docs/src/components/site/packages.tsx",
      lineOf(packageCards, packageCards.indexOf("const GROUPS")),
      times
        ? `${name} is in ${times} package groups`
        : `${name} is in no package group`
    )
}
for (const name of grouped)
  if (!PACKAGES.some((entry) => entry.name === name))
    report(
      "apps/docs/src/components/site/packages.tsx",
      lineOf(packageCards, packageCards.indexOf(`"${name}"`)),
      `${name} is in a package group but not a package`
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
