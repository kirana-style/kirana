/**
 * What the site says about Kirana that can go stale: counts, the lists of frameworks, bundlers,
 * linters and agent surfaces, and the CLI's commands. Each is computed from the source that owns
 * it — the compiler's catalogue, the lint plugins, the packages, the install guides — never typed
 * twice. Components import these; markdown writes `{{fact:name}}` and the content generator fills it in
 * from `FACTS` (an unknown name fails the build). `scripts/check-consistency.ts` fails on a count
 * written out by hand. See CONSISTENCY.md.
 */
import { API, COMMANDS } from "../generated/cli.gen.ts"
import { DIAGNOSTICS } from "../generated/diagnostics.gen.ts"
import { LINT } from "../generated/lint.gen.ts"
import { PACKAGES } from "../generated/packages.gen.ts"
import { RUNTIME_SIZE } from "./benchmarks.ts"
import { FRAMEWORK_GUIDES } from "./frameworks.ts"
import type { GuideGroup } from "./frameworks.ts"
import { LINTERS } from "./tooling.ts"

/** `a, b and c` (or `or`): how the site writes a list in a sentence. */
export function sentence(items: readonly string[], last = "and"): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`
}

/** How prose names a guide's subject; a guide that is not a product (`No framework`) is left out. */
const SPOKEN: Readonly<Record<string, string | null>> = {
  "Ember.js": "Ember",
  "Ruby on Rails": "Rails",
  "No framework": null,
}

const guides = (group: GuideGroup) =>
  FRAMEWORK_GUIDES.filter((guide) => guide.group === group).flatMap((guide) => {
    const name = SPOKEN[guide.title]
    if (name === null) return []
    // A guide for two products (`Rspack and Rsbuild`) names each.
    return (name ?? guide.title).split(" and ")
  })

/** The component layers `sx` is written in; the frameworks built on one of them are the rest. */
const LIBRARIES = [
  "React",
  "Preact",
  "Solid",
  "Qwik",
  "Vue",
  "Svelte",
  "Astro",
  "Angular",
  "Ember",
]

if (LIBRARIES.some((name) => !guides("frameworks").includes(name)))
  throw new Error("facts.ts: a component layer has no framework guide")

/**
 * Whether the packages are on npm, read from their `package.json` (`private` until they are). Every
 * "not on npm yet" notice reads this one flag, so publishing removes them all at once.
 */
export const PUBLISHED = PACKAGES.every((entry) => entry.published)

export const COUNTS = {
  diagnostics: DIAGNOSTICS.length,
  lintRules: LINT.length,
  biomeRules: LINT.filter((rule) => rule.biome).length,
  packages: PACKAGES.length,
  frameworks: guides("frameworks").length,
  serverFrameworks: guides("server").length,
  bundlers: guides("bundlers").length,
  commands: COMMANDS.length,
} as const

export const LISTS = {
  frameworks: guides("frameworks"),
  libraries: LIBRARIES.filter((name) => guides("frameworks").includes(name)),
  serverFrameworks: guides("server"),
  /** The bundlers proper; PostCSS and Jest have guides in the same group but are not bundlers. */
  bundlers: guides("bundlers").filter(
    (name) => !["PostCSS", "Jest"].includes(name)
  ),
  linters: LINTERS.map((linter) => linter.title),
  /** What a coding agent gets, in the order the site names them. */
  agents: [
    "agent skills",
    "llms.txt",
    "llms-full.txt",
    "a markdown twin of every page",
  ],
  commands: COMMANDS.map((command) => `kirana ${command}`),
  api: [...API],
  biomeRules: LINT.filter((rule) => rule.biome).map((rule) => rule.name),
} as const

/** Number words for counts a sentence starts with or spells out. */
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
  "eleven",
  "twelve",
]
const word = (count: number) => WORDS[count] ?? String(count)

/** The `{{fact:name}}` values markdown may use. */
export const FACTS: Readonly<Record<string, string>> = {
  diagnostics: String(COUNTS.diagnostics),
  "lint-rules": String(COUNTS.lintRules),
  "lint-rules-word": word(COUNTS.lintRules),
  "biome-rules": String(COUNTS.biomeRules),
  "biome-rules-word": word(COUNTS.biomeRules),
  packages: String(COUNTS.packages),
  frameworks: sentence(LISTS.frameworks),
  libraries: sentence(LISTS.libraries),
  "frameworks-count": String(COUNTS.frameworks),
  "server-frameworks": sentence(LISTS.serverFrameworks),
  bundlers: sentence(LISTS.bundlers),
  linters: sentence(LISTS.linters),
  "linters-or": sentence(LISTS.linters, "or"),
  agents: sentence(LISTS.agents),
  api: sentence(LISTS.api.map((name) => `\`${name}\``)),
  // The compiler's default targets (`FLOOR` in kirana_config, D-026), the first versions with
  // `light-dark()`; the site's Vite config holds its build to the same floor.
  "browser-floor": "Chrome 123, Safari 17.5, Firefox 120",
  "runtime-size": RUNTIME_SIZE,
}
