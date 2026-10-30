/**
 * Writes the generated references of the agent skills in `skills/` (D-078) from the compiler's own
 * source, so a skill cannot fall behind it:
 *
 *   skills/kirana/references/diagnostics.md  every code in the catalogue, with what to do about it
 *   skills/kirana/references/lint.md         every lint rule, its configs and the linters that run it
 *
 * It also checks every skill: its `name` matches its folder, its `description` is at most 1024
 * characters (what `npx skills` reads), and every `references/` file and docs page it names exists.
 * A catalogue code with no line in `FIXES` fails the script, and so does a line for a code that is
 * gone. `--check` fails when the committed output is stale.
 */
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const repository = join(root, "../..")
const kirana = join(repository, "packages/kirana")
const references = join(repository, "skills/kirana/references")
const check = process.argv.includes("--check")

/** `Variant = "KRN1234", "kebab-name", Severity;` */
const ENTRY =
  /^\s*(\w+)\s*=\s*"(KRN\d+)",\s*"([a-z0-9-]+)",\s*(Info|Warning|Error);\s*$/gm

/** What to do about each diagnostic, by name. Each line starts with what the code means. */
const FIXES: Record<string, string> = {
  "parse-error":
    "The file does not parse. Fix the syntax; nothing in it compiles until it does.",
  "not-evaluable":
    "A value the compiler must know at build time is not static (an argument read from a variable it cannot follow, a computed name). Write it out, or import it from a module the compiler can read.",
  "unsupported-syntax":
    "The expression is valid JavaScript the evaluator does not run in a style (calling a non-function, applying a plain object as a style). Wrap style objects in `css()`; move logic out of the style.",
  "unresolved-import":
    "An import a style depends on did not resolve, so its value is treated as runtime. Check the specifier and `tsconfig` paths.",
  "import-cycle":
    "A value a style reads comes through an import cycle (`a.ts → b.ts → a.ts`): the module that closes it reads the other before it is evaluated, so the value is treated as runtime. Move what both need into a module neither imports back. `import type` never makes a cycle.",
  "unknown-property":
    "Not a CSS property (a typo such as `colour`, or a Tailwind class name used as a key). Use the camelCase CSS property name.",
  "invalid-value":
    'The value does not fit the property\'s grammar: a keyword it does not take (`padding: "red"`), a negative size, or a token of the wrong kind (a colour token on `padding`). The message gives the grammar. Words the data does not know, function arguments and `var()` are never judged.',
  "unitless-length":
    'A bare number on a length property. Write the unit: `width: "5px"`, or a token.',
  "unsplittable-shorthand":
    "A shorthand whose value cannot be split into longhands (`border: var(--x)`) stays whole, so a later style cannot remove one longhand. Write the longhands.",
  "mixed-logical-physical":
    "Logical and physical longhands on one box (`paddingInlineStart` and `padding`) sit side by side instead of replacing each other; or an inline logical inset beside a `translate`, which has no logical form and is off centre in right-to-left text. Use one family: `left` with a translate.",
  "invalid-fallback":
    "A `firstThatWorks()` the browser would drop or misread: empty, nested, a runtime value, or values that set different longhands. Keep every value static and of the same shape.",
  "fallback-on-variable":
    "`firstThatWorks()` on a custom property: a variable never falls back, the last value always wins. Put the fallback where the variable is read: `var(--x, fallback)`.",
  "invalid-position-try":
    "A property `@position-try` ignores. The block takes inset, margin, size, self-alignment, `positionAnchor` and `positionArea` only.",
  "invalid-view-transition":
    "A `viewTransition()` key other than `group`, `imagePair`, `old`, `new`, or a condition other than `media()`/`supports()` on a part.",
  "invalid-counter-style":
    "A `counterStyle()` key that is not a descriptor, a value with `var()` (descriptors cannot read custom properties), an empty or runtime value, or a system without what it needs: `symbols`, or `additiveSymbols` for `additive`, and neither for `extends`.",
  "unknown-condition":
    'A key that is neither a property nor a condition, usually a condition at the top level (`":hover": {…}`). Conditions go inside the value: `color: { base: a, ":hover": b }`.',
  "ambiguous-precedence":
    "Two conditions of the same kind can match together with different values and nothing orders them. Nest one inside the other, or list the pair in `conditions.exclusive` when they never match together. Do not re-level it to hide the tie.",
  "unsupported-contextual-target":
    "A `select.descendant()`/`select.child()` target must be one compound selector: an element name, classes, attribute selectors and pseudo-classes. No combinator, ID or pseudo-element; a pseudo-element is a key inside the target's style.",
  "select-state-on-parent":
    "Info: a pseudo-class nested under a `select` target is the state of the element carrying the style, not the target's. For the target's own, put it in the target: `select.child(\"a:hover\")`.",
  "unreachable-entry":
    "Info: a nested condition key can never match together with the one around it (two values of one attribute, a `conditions.exclusive` group). Its entries are left out of the stylesheet; write each state's value under its own key. Two libraries' states kept apart by `exclusiveAcross` are left out too, without the info.",
  "relation-without-anchor":
    "A style reads a relation whose `anchor` is never applied, so it can never match. Apply `rel.anchor` on the element whose state is read, or declare the relation `{ optional: true }` when its anchor's component may not be installed.",
  "relation-unused":
    "A relation is anchored but never read. Remove the anchor, or read it with `within`/`after`/`before`. A component that anchors it for another the project may not install declares it `relation(name, { optional: true })`.",
  "relation-placement":
    "A relation is read from a position its anchor cannot be in (`within` needs the anchor on an ancestor, `after` on an earlier sibling). Move the anchor or use the other read.",
  "relation-read-on-anchor":
    "Info: an element carries a relation's anchor and reads a state through it (`within`, `parent`), which matches only inside another element with the anchor, never on this one. For the element's own state, use the state as the condition key (`'[data-disabled=\"true\"]'`).",
  "relation-name-collision":
    "Two modules declare a relation with one name, so they share a marker. Declare it once, export it, and import it where it is read.",
  "unknown-token":
    "The token group has no token by that name. Check the name against `kirana-style export`.",
  "token-namespace-collision":
    "Two modules declare one token namespace. Give each `defineTokens()` its own namespace.",
  "variable-default-scope":
    "Reserved, not emitted yet: a variable token's default reads a custom property that exists only on a descendant. Assign the value on the element that owns it.",
  "dynamic-token":
    "A token value is not known at build time. Token values must be static; bridge runtime values in the style instead.",
  "unsupported-dtcg-type":
    "Reserved, not emitted yet (DTCG import is not built): a DTCG token type the importer does not map. Convert it to a plain value.",
  "token-not-variable":
    "A theme overrides, or a style needs to vary, a token declared without `{ variable: true }`. Declare it as a variable token.",
  "token-namespace-shared":
    "Info: two packages declare a token group of one name. Their tokens compile apart but read alike as `group.*`; `kirana-style export` names each token's package. Rename one if both are in use.",
  "dynamic-bridged":
    "Info: a runtime value became a custom property and an inline `style`. Fine for continuous values; a few known values are cheaper as variants.",
  "branch-budget-exceeded":
    "Too many runtime branches in one style. Split it into separate handles, or raise `dynamic.branchBudget`.",
  "dynamic-key":
    "A property or condition key known only at runtime. Use a fixed key and put the choice in the value.",
  "dynamic-spread":
    "A runtime object spread into a style. Declare the properties explicitly.",
  "dynamic-variant":
    "Info: a recipe call with a runtime option resolves through the runtime table. Pass literal options where you can.",
  "unused-sx":
    "A component takes `sx` and never applies it. Pass it on: `sx={[styles.root, sx]}`, and take it out of a rest spread.",
  "utility-surface-disabled":
    "A string `sx` without a utility grammar. Add a preset that declares one (`presets: [scales()]`), or write `css({…})`.",
  "unknown-utility":
    "A utility the configured grammar does not know. Check the name, or write the style as an object.",
  "unknown-utility-variant":
    "A utility variant the grammar does not declare. Declare it under `utilities.variants`, or write the condition in an object.",
  "utility-not-static":
    "An interpolated utility string. Write whole strings, or an object with the value.",
  "utility-unsupported":
    "A utility feature Kirana does not have (`!important`, two pseudo-elements). The precedence ladder decides; see `kirana-style trace`.",
  "unknown-variant":
    "A recipe call names a variant group or option the recipe does not have. Check it against the recipe (`kirana-style export` lists them).",
  "unknown-slot":
    "A recipe names a slot not listed in `slots`. Add it to `slots`, or fix the key.",
  "invalid-config":
    "`kirana.config.*` does not match the schema. The message names the key.",
  "target-lowering":
    "Info: the stylesheet is lowered for browser targets below the default floor. Expected when you set old targets.",
  "class-name-collision":
    "Two different atoms hashed to one class name. The build cannot be trusted: report it with `kirana-style doctor --report`.",
  "classes-not-static":
    "A module listed in `classes.modules` exports a style with no class string a template can use. Export static handles.",
  "unknown-class-name":
    "A template asks the class map for a style it does not list. Export it from a module in `classes.modules`, or fix the name.",
  "sx-on-external-component":
    "`sx` given to a component from an installed package, which does not read it. Spread `{...styleProps(a, sx)}` (`props as styleProps` from `@kirana-style/core`) instead. A Kirana library listed in `libraries` is compiled as the app's own, and its components read `sx`.",
}

const source = await readFile(
  join(kirana, "crates/kirana_diagnostics/src/lib.rs"),
  "utf8"
)
const diagnostics = [...source.matchAll(ENTRY)].map((match) => ({
  code: match[2]!,
  name: match[3]!,
  severity: match[4]!.toLowerCase(),
}))
if (diagnostics.length === 0)
  throw new Error(
    "no diagnostics found; the catalogue macro's shape must have changed"
  )
const missing = diagnostics.filter(({ name }) => !(name in FIXES))
const stale = Object.keys(FIXES).filter(
  (name) => !diagnostics.some((diagnostic) => diagnostic.name === name)
)
if (missing.length || stale.length)
  throw new Error(
    `scripts/generate-skills.ts: write what to do for ${missing.map(({ name }) => name).join(", ") || "none"}; remove ${stale.join(", ") || "none"}`
  )

const diagnosticsPage = `<!-- @generated by apps/docs/scripts/generate-skills.ts from the diagnostics catalogue. Do not edit. -->

# Diagnostics

Every code the compiler reports, and what to do about it. \`kirana-style check\` prints
\`severity[CODE] name: message\` with the location and a \`help:\` line; the help line is
specific to the case and wins over this table. Errors fail the build; warnings and infos
can be re-levelled in \`kirana.config.*\` under \`diagnostics\` (errors cannot).

Full page: https://kirana.style/docs/tooling/diagnostics.md

| Code | Name | Severity | What it means and what to do |
| --- | --- | --- | --- |
${diagnostics
  .map(
    ({ code, name, severity }) =>
      `| ${code} | \`${name}\` | ${severity} | ${FIXES[name]!.replaceAll("|", "\\|")} |`
  )
  .join("\n")}
`

/** Each ESLint/Oxlint rule: its name, description, fix kind and config. */
const index = await readFile(
  join(kirana, "npm/eslint-plugin/src/index.ts"),
  "utf8"
)
const recommendedBlock = index.slice(
  index.indexOf("const recommended"),
  index.indexOf("const strict")
)
const strictBlock = index.slice(index.indexOf("const strict"))
const levels = (block: string) =>
  new Map(
    [...block.matchAll(/"kirana\/([\w-]+)": "(error|warn)"/g)].map(
      (match) => [match[1]!, match[2]!] as const
    )
  )
const recommended = levels(recommendedBlock)
const strict = levels(strictBlock)
const biomeRules = new Set(
  (await readdir(join(kirana, "npm/biome-plugin/rules"))).map((file) =>
    file.replace(/\.grit$/, "")
  )
)
const biomeRecommended = await readFile(
  join(kirana, "npm/biome-plugin/recommended.json"),
  "utf8"
)
const biomeStrict = await readFile(
  join(kirana, "npm/biome-plugin/strict.json"),
  "utf8"
)
const rules = []
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
  const config = recommended.has(name)
    ? `recommended (${recommended.get(name)})`
    : strict.has(name)
      ? `strict (${strict.get(name)})`
      : "off"
  const fix = text.includes('fixable: "code"')
    ? "autofix"
    : text.includes("hasSuggestions: true")
      ? "suggestions"
      : ""
  const biome = biomeRules.has(name)
    ? biomeRecommended.includes(`${name}.grit`)
      ? "recommended"
      : biomeStrict.includes(`${name}.grit`)
        ? "strict"
        : "off"
    : "no"
  rules.push({ name, description, config, fix, biome })
}
for (const name of biomeRules)
  if (!rules.some((rule) => rule.name === name))
    throw new Error(`the Biome rule ${name} has no ESLint original`)

const lintPage = `<!-- @generated by apps/docs/scripts/generate-skills.ts from the lint plugins. Do not edit. -->

# Lint rules

\`@kirana-style/eslint-plugin\` runs under ESLint and Oxlint with identical results; its rules
read the compiler. \`@kirana-style/biome-plugin\` carries the rules that need no compiler as
Biome GritQL plugins. Under Biome, run \`kirana-style check --format github --max-warnings 0\`
in CI for what the compiler-backed rules would report.

Full page: https://kirana.style/docs/tooling/lint.md

| Rule | ESLint / Oxlint | Fix | Biome | What it reports |
| --- | --- | --- | --- | --- |
${rules
  .map(
    (rule) =>
      `| \`kirana/${rule.name}\` | ${rule.config} | ${rule.fix} | ${rule.biome} | ${rule.description} |`
  )
  .join("\n")}

## Configure

\`\`\`js
// eslint.config.js
import kirana from "@kirana-style/eslint-plugin"

export default [kirana.configs.recommended] // or kirana.configs.strict
\`\`\`

\`\`\`jsonc
// .oxlintrc.json
{
  "jsPlugins": [{ "name": "kirana", "specifier": "@kirana-style/eslint-plugin" }],
  "rules": { "kirana/diagnostics": "error", "kirana/sx-last": "error" }
}
\`\`\`

\`\`\`jsonc
// biome.json
{ "extends": ["@kirana-style/biome-plugin/recommended"] } // or /strict
\`\`\`

\`\`\`yaml
# CI under Biome: the compiler's own diagnostics, as pull-request annotations
- run: npx kirana-style check src --format github --max-warnings 0
\`\`\`
`

/** Problems with the skills themselves, after the references are written. */
async function validate(): Promise<string[]> {
  const problems: string[] = []
  const skills = join(repository, "skills")
  const pages = join(root, "content/docs")
  for (const name of await readdir(skills)) {
    const directory = join(skills, name)
    const text = await readFile(join(directory, "SKILL.md"), "utf8")
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? ""
    if (/^name: (.*)$/m.exec(front)?.[1] !== name)
      problems.push(`skills/${name}: frontmatter name must be ${name}`)
    const description = /^description: (.*)$/m.exec(front)?.[1] ?? ""
    if (!description || description.length > 1024)
      problems.push(`skills/${name}: description must be 1-1024 characters`)
    const files = [
      "SKILL.md",
      ...(await readdir(join(directory, "references")).catch(() => [])).map(
        (file) => `references/${file}`
      ),
    ]
    for (const file of files) {
      const body = await readFile(join(directory, file), "utf8")
      for (const [, reference] of body.matchAll(/`(references\/[\w.-]+)`/g))
        if (!files.includes(reference!))
          problems.push(`skills/${name}/${file}: ${reference} does not exist`)
      for (const [, page] of body.matchAll(
        /https:\/\/kirana\.style\/docs\/([\w/-]+)\.md/g
      )) {
        const exists = await readFile(join(pages, `${page}.md`)).then(
          () => true,
          () => false
        )
        if (!exists)
          problems.push(`skills/${name}/${file}: no docs page ${page}`)
      }
      for (const [, page] of body.matchAll(
        /`((?:start|styling|reference|tooling|tokens|migration|frameworks)\/[\w-]+)\.md`/g
      )) {
        const exists = await readFile(join(pages, `${page}.md`)).then(
          () => true,
          () => false
        )
        if (!exists)
          problems.push(`skills/${name}/${file}: no docs page ${page}`)
      }
    }
  }
  return problems
}

let outdated = false
for (const [name, text] of [
  ["diagnostics.md", diagnosticsPage],
  ["lint.md", lintPage],
] as const) {
  const path = join(references, name)
  const current = await readFile(path, "utf8").catch(() => undefined)
  if (current === text) continue
  outdated = true
  if (!check) await writeFile(path, text)
  else
    console.error(
      `skills/kirana/references/${name} is stale. Run \`bun run generate:skills\`.`
    )
}
const problems = await validate()
for (const problem of problems) console.error(problem)
if (problems.length || (check && outdated)) process.exit(1)
