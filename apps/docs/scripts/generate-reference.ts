/**
 * Reads the compiler's own source and writes the reference data the site renders.
 *
 *   src/generated/diagnostics.gen.ts  every code in the diagnostics catalogue
 *   src/generated/packages.gen.ts     each package's version and publish status
 *   src/generated/lint.gen.ts         every lint rule: its config, fix and whether Biome runs it
 *   src/generated/cli.gen.ts          every `kirana` command, and `@kirana-style/core`'s exports
 *
 * Parsing Rust source text rather than running anything keeps this script free of
 * the native engine, so it runs anywhere. `--check` fails when the committed
 * output is stale, which is what CI runs.
 */
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const kirana = join(root, "../../packages/kirana")
const generated = join(root, "src/generated")
const check = process.argv.includes("--check")

/** `Variant = "KRN1234", "kebab-name", Severity;` */
const ENTRY =
  /^\s*(\w+)\s*=\s*"(KRN\d+)",\s*"([a-z0-9-]+)",\s*(Info|Warning|Error);\s*$/gm

/** Which part of the compiler a code comes from, by its number. */
const FAMILIES: [number, string][] = [
  [1000, "Parsing"],
  [1100, "Evaluation"],
  [1200, "Properties and values"],
  [1300, "Conditions"],
  [1400, "Relations"],
  [1500, "Tokens"],
  [1600, "Dynamic styles"],
  [1700, "Authoring"],
  [1800, "Recipes"],
  [1900, "Configuration"],
]

function family(code: string): string {
  const number = Number(code.slice(3))
  return (
    [...FAMILIES].reverse().find(([floor]) => number >= floor)?.[1] ?? "Other"
  )
}

const source = await readFile(
  join(kirana, "crates/kirana_diagnostics/src/lib.rs"),
  "utf8"
)
const diagnostics = [...source.matchAll(ENTRY)].map((match) => ({
  code: match[2]!,
  name: match[3]!,
  severity: match[4]!.toLowerCase(),
  family: family(match[2]!),
}))

if (diagnostics.length === 0) {
  throw new Error(
    "no diagnostics found; the catalogue macro's shape must have changed"
  )
}
const codes = new Set(diagnostics.map((diagnostic) => diagnostic.code))
if (codes.size !== diagnostics.length)
  throw new Error("duplicate diagnostic codes")

const packages = []
for (const name of [
  "core",
  "vite",
  "rolldown",
  "webpack",
  "next",
  "postcss",
  "rspack",
  "bun",
  "esbuild",
  "jest",
  "astro",
  "angular",
  "ember",
  "gatsby",
  "parcel-transformer",
  "adonis",
  "compiler",
  "cli",
  "preset-scales",
  "eslint-plugin",
  "biome-plugin",
]) {
  const manifest = JSON.parse(
    await readFile(join(kirana, "npm", name, "package.json"), "utf8")
  ) as {
    name: string
    version: string
    private?: boolean
    publishConfig?: { access?: string }
    description?: string
  }
  packages.push({
    name: manifest.name,
    version: manifest.version,
    // `private` stays true in the workspace, so a folder of TypeScript source can never be published
    // by mistake; `publishConfig.access: "public"` says the package is on npm (the pack script keeps
    // it in the tarball, and drops `private`).
    published: manifest.publishConfig?.access === "public",
    description: manifest.description ?? "",
  })
}

/** Each lint rule, from the plugins' source: the ESLint/Oxlint config it is in, and Biome's. */
const index = await readFile(
  join(kirana, "npm/eslint-plugin/src/index.ts"),
  "utf8"
)
const levels = (block: string) =>
  new Map(
    [...block.matchAll(/"kirana\/([\w-]+)": "(error|warn)"/g)].map(
      (match) => [match[1]!, match[2]!] as const
    )
  )
const recommended = levels(
  index.slice(index.indexOf("const recommended"), index.indexOf("const strict"))
)
const strict = levels(index.slice(index.indexOf("const strict")))
const biomeRules = new Set(
  (await readdir(join(kirana, "npm/biome-plugin/rules"))).map((file) =>
    file.replace(/\.grit$/, "")
  )
)
const biomeRecommended = await readFile(
  join(kirana, "npm/biome-plugin/recommended.json"),
  "utf8"
)
const lint = []
for (const file of (
  await readdir(join(kirana, "npm/eslint-plugin/src/rules"))
).sort()) {
  const name = file.replace(/\.ts$/, "")
  const text = await readFile(
    join(kirana, "npm/eslint-plugin/src/rules", file),
    "utf8"
  )
  const description = /description:\s*"([^"]+)"/.exec(text)?.[1]
  if (!description) throw new Error(`no description in rules/${file}`)
  lint.push({
    name,
    description,
    config: recommended.has(name)
      ? "recommended"
      : strict.has(name)
        ? "strict"
        : "off",
    level: recommended.get(name) ?? strict.get(name) ?? "off",
    fix: text.includes('fixable: "code"')
      ? "autofix"
      : text.includes("hasSuggestions: true")
        ? "suggestions"
        : "",
    biome: biomeRules.has(name)
      ? biomeRecommended.includes(`${name}.grit`)
        ? "recommended"
        : "strict"
      : "",
  })
}
for (const name of biomeRules)
  if (!lint.some((rule) => rule.name === name))
    throw new Error(`the Biome rule ${name} has no ESLint original`)

/**
 * Every `kirana` command: the Rust command line's subcommands (hidden ones left out) and the ones
 * the Node.js driver runs itself.
 */
const cliSource = await readFile(
  join(kirana, "crates/kirana_cli/src/lib.rs"),
  "utf8"
)
const commandEnum = cliSource.slice(
  cliSource.indexOf("enum Command {"),
  cliSource.indexOf("\n}\n", cliSource.indexOf("enum Command {"))
)
const rustCommands = [
  ...commandEnum.matchAll(/((?:\s*#\[[^\]]*\]\n)*)\s{4}(\w+)(?: \{|,)/g),
]
  .filter((match) => !match[1]!.includes("hide = true"))
  .map((match) => match[2]!.toLowerCase())
const driver = await readFile(join(kirana, "npm/compiler/src/cli.ts"), "utf8")
const nodeCommands = [...driver.matchAll(/command === "(\w+)"/g)].map(
  (match) => match[1]!
)
const commands = [...new Set([...nodeCommands, ...rustCommands])].sort()
const core = await readFile(join(kirana, "npm/core/src/index.ts"), "utf8")
const api = [...core.matchAll(/^export (?:function|const) (\w+)/gm)].map(
  (match) => match[1]!
)
if (commands.length < 5) throw new Error("the CLI's commands were not found")

const files: [string, string][] = [
  [
    "diagnostics.gen.ts",
    `// @generated by scripts/generate-reference.ts from crates/kirana_diagnostics/src/lib.rs. Do not edit.
export type DiagnosticEntry = {
  readonly code: string
  readonly name: string
  readonly severity: string
  readonly family: string
}

export const DIAGNOSTICS: readonly DiagnosticEntry[] = ${JSON.stringify(diagnostics, null, 2)}
`,
  ],
  [
    "packages.gen.ts",
    `// @generated by scripts/generate-reference.ts from packages/kirana/npm/*/package.json. Do not edit.
export type PackageEntry = {
  readonly name: string
  readonly version: string
  /** True once the package is on npm (its publishConfig.access is "public"); every install page reads it. */
  readonly published: boolean
  readonly description: string
}

export const PACKAGES: readonly PackageEntry[] = ${JSON.stringify(packages, null, 2)}
`,
  ],
  [
    "lint.gen.ts",
    `// @generated by scripts/generate-reference.ts from packages/kirana/npm/{eslint,biome}-plugin. Do not edit.
export type LintEntry = {
  readonly name: string
  readonly description: string
  readonly config: "recommended" | "strict" | "off"
  readonly level: "error" | "warn" | "off"
  readonly fix: "" | "autofix" | "suggestions"
  /** The Biome preset that runs it, or "" when Biome cannot. */
  readonly biome: "" | "recommended" | "strict"
}

export const LINT: readonly LintEntry[] = ${JSON.stringify(lint, null, 2)}
`,
  ],
  [
    "cli.gen.ts",
    `// @generated by scripts/generate-reference.ts from crates/kirana_cli and npm/compiler. Do not edit.
export const COMMANDS: readonly string[] = ${JSON.stringify(commands, null, 2)}

/** \`@kirana-style/core\`'s runtime exports, in source order. */
export const API: readonly string[] = ${JSON.stringify(api, null, 2)}
`,
  ],
]

let stale = false
for (const [name, text] of files) {
  const path = join(generated, name)
  const current = await readFile(path, "utf8").catch(() => undefined)
  if (current === text) continue
  stale = true
  if (!check) await writeFile(path, text)
  else
    console.error(
      `src/generated/${name} is stale. Run \`bun run generate:reference\`.`
    )
}

if (check && stale) process.exit(1)
console.log(
  `reference: ${diagnostics.length} diagnostics, ${packages.length} packages${check ? " up to date" : ""}`
)
