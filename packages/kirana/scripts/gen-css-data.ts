/**
 * Generates `crates/kirana_css_data/src/generated.rs` and `npm/core/src/families.generated.ts` from
 * MDN's `mdn-data` (CC0-1.0, https://github.com/mdn/data). Run with `bun run gen:css-data`;
 * CI regenerates it and fails when the committed file differs.
 *
 * The engine owns no hand-written property list: a property Kirana does not
 * know is a property MDN does not know, which keeps `unknown-property` honest.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const dataDir = path.dirname(require.resolve("mdn-data/css/properties.json"))
const read = (name: string) =>
  JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as Record<
    string,
    { syntax?: string; computed?: string[] | string; status?: string }
  >

const properties = read("properties.json")
const syntaxes = read("syntaxes.json")
const selectors = read("selectors.json")

const names = Object.keys(properties).sort()

/**
 * Box shorthand families (D-045): a single component sets every longhand to itself, so one
 * shorthand atom stands for them. Four-longhand families come first, then two-longhand ones, each
 * shorthand directly followed by its longhands, so a longhand's code is its shorthand's code plus
 * its position and the private runtime needs no table. The most used families come first and get
 * one-character codes.
 */
const families4 = [
  "padding",
  "margin",
  "border-radius",
  "border-width",
  "border-color",
  "border-style",
  "inset",
  "scroll-margin",
  "scroll-padding",
]
const families2 = [
  "gap",
  "overflow",
  "padding-inline",
  "padding-block",
  "margin-inline",
  "margin-block",
  "inset-inline",
  "inset-block",
  "place-items",
  "place-content",
  "place-self",
  "overscroll-behavior",
  "border-inline-width",
  "border-inline-color",
  "border-inline-style",
  "border-block-width",
  "border-block-color",
  "border-block-style",
  "scroll-margin-inline",
  "scroll-margin-block",
  "scroll-padding-inline",
  "scroll-padding-block",
]
const members = (family: string, size: number) => {
  const computed = properties[family]!.computed
  if (!Array.isArray(computed) || computed.length !== size)
    throw new Error(`${family}: expected ${size} longhands`)
  return [family, ...computed]
}
const familyBlock = [
  ...families4.flatMap((family) => members(family, 4)),
  ...families2.flatMap((family) => members(family, 2)),
]
const ordered = [
  ...familyBlock,
  ...names.filter((name) => !familyBlock.includes(name)),
]

/** Whether a property's grammar accepts a bare `<number>` or `<integer>`. */
function acceptsNumber(syntax: string, seen = new Set<string>()): boolean {
  if (/<(number|integer)(\s*\[[^\]]*\])?>/.test(syntax)) return true
  for (const match of syntax.matchAll(/<'([a-z-]+)'>|<([a-z-]+)>/g)) {
    const key = match[1] ? `'${match[1]}'` : match[2]!
    if (seen.has(key)) continue
    seen.add(key)
    const next = match[1]
      ? properties[match[1]]?.syntax
      : syntaxes[match[2]!]?.syntax
    if (next && acceptsNumber(next, seen)) return true
  }
  return false
}

const numeric = names.filter((name) =>
  acceptsNumber(properties[name]!.syntax ?? "")
)
const shorthands = names.filter((name) =>
  Array.isArray(properties[name]!.computed)
)
const unique = (keys: string[]) =>
  [...new Set(keys.map((key) => key.replace(/\(\)$/, "")))].sort()
const pseudoClasses = unique(
  Object.keys(selectors).filter(
    (key) => key.startsWith(":") && !key.startsWith("::")
  )
)
const pseudoElements = unique(
  Object.keys(selectors).filter((key) => key.startsWith("::"))
)

// Colour keywords, lowercase, sorted: named colours and system colours (current and deprecated).
const colourKeywords = unique(
  ["named-color", "system-color", "deprecated-system-color"].flatMap((name) =>
    syntaxes[name]!.syntax!.split("|").map((keyword: string) =>
      keyword.trim().toLowerCase()
    )
  )
)

/**
 * The keywords a property's value may be, for editor completion (KRN-DX-005): bare identifiers in
 * its grammar, following referenced types and properties. Colour keywords are left out (a colour
 * picker serves them better than 170 completions), and so are the CSS-wide keywords, which the
 * language server adds to every property.
 */
const skipTypes = new Set([
  "color",
  "named-color",
  "system-color",
  "deprecated-system-color",
  "absolute-color-base",
  "absolute-color-function",
])
function keywordsOf(syntax: string, out: Set<string>, seen: Set<string>) {
  const bare = syntax
    .replace(/<[^>]*>/g, " ")
    .replace(/[a-z-]+\(/g, " ")
    .replace(/'[^']*'/g, " ")
  for (const match of bare.matchAll(/(?<![\w-])[a-z][a-z0-9-]*(?![\w(-])/g))
    out.add(match[0])
  for (const match of syntax.matchAll(
    /<'([a-z-]+)'>|<([a-z-]+)(?:\s*\[[^\]]*\])?>/g
  )) {
    const key = match[1] ? `'${match[1]}'` : match[2]!
    if (seen.has(key) || skipTypes.has(match[2] ?? "")) continue
    seen.add(key)
    const next = match[1]
      ? properties[match[1]]?.syntax
      : syntaxes[match[2]!]?.syntax
    if (next) keywordsOf(next, out, seen)
  }
}
const keywords = names.map((name) => {
  const out = new Set<string>()
  keywordsOf(properties[name]!.syntax ?? "", out, new Set())
  return [name, [...out].sort()] as const
})

/**
 * The value grammars `kirana_css_data::grammar` checks values against (KRN-CAS-010): each
 * property's syntax and every named syntax it references, as MDN writes them.
 */
const propertySyntax = names
  .filter((name) => properties[name]!.syntax)
  .map((name) => [name, properties[name]!.syntax!] as const)
const namedSyntax = Object.keys(syntaxes)
  .sort()
  .filter((name) => syntaxes[name]!.syntax)
  .map((name) => [name, syntaxes[name]!.syntax!] as const)
/**
 * Every keyword and function name any grammar names, and every property name (`transition-property:
 * translate`, `will-change: opacity`). A value with a word outside these is newer CSS than the data,
 * or a name of the author's own, and is never rejected (P11).
 */
const grammars = [...propertySyntax, ...namedSyntax].map(([, syntax]) => syntax)
const grammarWords = grammars.flatMap((syntax) =>
  [
    ...syntax
      .replace(/<[^>]*>/g, " ")
      .replace(/'[^']*'/g, " ")
      .matchAll(/(?<![\w-])-?[a-zA-Z][a-zA-Z0-9-]*(?![\w(-])/g),
  ].map((match) => match[0].toLowerCase())
)
const knownWords = [...new Set([...grammarWords, ...names])].sort()
const knownFunctions = [
  ...new Set([
    ...grammars.flatMap((syntax) =>
      [...syntax.matchAll(/(?<![\w-])(-?[a-zA-Z][a-zA-Z0-9-]*)\(/g)].map(
        (match) => match[1]!.toLowerCase()
      )
    ),
    ...Object.keys(syntaxes)
      .filter((name) => name.endsWith("()"))
      .map((name) => name.slice(0, -2).toLowerCase()),
    // `<url>` is a base type: `url()` and `src()`, which no grammar spells out.
    "url",
    "src",
    ...Object.keys(read("functions.json")).map((name) =>
      name.replace(/\(\)$/, "").toLowerCase()
    ),
  ]),
].sort()
const pairs = (items: readonly (readonly [string, string])[]) =>
  items
    .map(
      ([name, syntax]) =>
        `    (${JSON.stringify(name)}, ${JSON.stringify(syntax)}),`
    )
    .join("\n")

const list = (items: string[]) =>
  items.map((item) => `    ${JSON.stringify(item)},`).join("\n")

const out = `// @generated by scripts/gen-css-data.ts from mdn-data ${
  JSON.parse(readFileSync(path.join(dataDir, "..", "package.json"), "utf8"))
    .version
} (CC0-1.0). Do not edit.

/// Every CSS property MDN documents. The index is the property code in class names: the box
/// shorthand families first (see [\`FAMILY_4_END\`]), then every other property, sorted.
pub static PROPERTIES: &[&str] = &[
${list(ordered)}
];

/// Every property with its index in [\`PROPERTIES\`], sorted by name.
pub static PROPERTY_INDEX: &[(&str, u16)] = &[
${names.map((name) => `    (${JSON.stringify(name)}, ${ordered.indexOf(name)}),`).join("\n")}
];

/// Indices below this are four-longhand families: a shorthand at every multiple of 5, its longhands after it.
pub const FAMILY_4_END: usize = ${families4.length * 5};
/// Indices from [\`FAMILY_4_END\`] below this are two-longhand families, in blocks of 3.
pub const FAMILY_2_END: usize = ${families4.length * 5 + families2.length * 3};

/// Properties whose grammar accepts a bare number (so a JavaScript number is not a unitless length).
pub static NUMERIC: &[&str] = &[
${list(numeric)}
];

/// Properties MDN documents as shorthands.
pub static SHORTHANDS: &[&str] = &[
${list(shorthands)}
];

/// Pseudo-classes, without \`()\`.
pub static PSEUDO_CLASSES: &[&str] = &[
${list(pseudoClasses)}
];

/// Pseudo-elements, without \`()\`.
pub static PSEUDO_ELEMENTS: &[&str] = &[
${list(pseudoElements)}
];

/// Keyword values each property's grammar names, sorted by property, for editor completion (colours
/// and CSS-wide keywords left out).
pub static KEYWORDS: &[(&str, &[&str])] = &[
${keywords.map(([name, words]) => `    (${JSON.stringify(name)}, &[${words.map((word) => JSON.stringify(word)).join(", ")}]),`).join("\n")}
];

/// Each property's value grammar, sorted by property.
pub static PROPERTY_SYNTAX: &[(&str, &str)] = &[
${pairs(propertySyntax)}
];

/// Every named syntax (\`<length-percentage>\`, \`<rgb()>\`), sorted by name.
pub static SYNTAXES: &[(&str, &str)] = &[
${pairs(namedSyntax)}
];

/// Every keyword a grammar names, lowercase, sorted.
pub static KNOWN_WORDS: &[&str] = &[
${list(knownWords)}
];

/// Every function a grammar names or MDN documents, lowercase, without \`()\`, sorted.
pub static KNOWN_FUNCTIONS: &[&str] = &[
${list(knownFunctions)}
];

/// Colour keywords, lowercase: named colours and system colours (\`red\`, \`canvastext\`).
pub static COLOUR_KEYWORDS: &[&str] = &[
${list(colourKeywords)}
];
`

writeFileSync(
  path.join(import.meta.dirname, "../crates/kirana_css_data/src/generated.rs"),
  out
)
writeFileSync(
  path.join(import.meta.dirname, "../npm/core/src/families.generated.ts"),
  `// @generated by scripts/gen-css-data.ts. Do not edit.
// Property codes below FOUR are four-longhand box families (a shorthand at every multiple of 5, its
// longhands after it); codes from FOUR below TWO are two-longhand families in blocks of 3 (D-045).
export const FOUR = ${families4.length * 5}
export const TWO = ${families4.length * 5 + families2.length * 3}
`
)
console.log(
  `${names.length} properties, ${numeric.length} numeric, ${shorthands.length} shorthands, ${pseudoClasses.length} pseudo-classes, ${pseudoElements.length} pseudo-elements`
)
