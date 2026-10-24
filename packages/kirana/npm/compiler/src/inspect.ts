/**
 * The inspection API (KRN-DX-001, KRN-DX-009): what the compiler knows about a module's styles, its
 * tokens and its relations. The language server and `@kirana-style/eslint-plugin` read these answers
 * instead of re-implementing the compiler. Spans count UTF-8 bytes, as diagnostics do;
 * `utf16Offset` converts one for JavaScript strings.
 */

export type Span = { start: number; end: number }

/** One atom a site applies, with the rule the stylesheet carries for it. */
export type SiteAtom = {
  /** Kebab-case property; a shorthand atom names the shorthand. */
  property: string
  value: string
  /** Readable conditions (`:hover`, `@media (width >= 40rem)`, `card.within(:hover)`). */
  conditions: string[]
  /** `""` for the element, `::before`, or a contextual target such as `> [data-slot="x"]`. */
  target: string
  class: string
  layer: "kirana.atoms" | "kirana.contextual"
  /** The CSS rule as the stylesheet writes it, at-rules included. */
  rule: string
  /** Identities of the variable tokens the value reads. */
  tokens: string[]
  /** Place among the site's atoms in stylesheet order; the higher rank wins when both apply. */
  rank: number
}

/** A `css()` call, `sx` value or recipe and the atoms it produces. */
export type Site = { span: Span; atoms: SiteAtom[] }

export type TokenInfo = {
  /** `namespace.path`. */
  identity: string
  package: string
  file: string
  /** The token's entry in `defineTokens`. */
  span: Span
  /** The value used in CSS: inlined text, or `light-dark(…)` for a colour pair. */
  value: string
  light: string | null
  dark: string | null
  /** Whether the token is a custom property. */
  variable: boolean
}

export type RelationInfo = {
  name: string
  marker: string
  declared_in: string[]
  anchored_in: string[]
  read_in: string[]
}

/** One condition of an entry, by kind (`kirana-style trace --format json`, `export --definitions`). */
export type ConditionInfo = {
  kind: "pseudo" | "attribute" | "media" | "container" | "supports" | "relation"
  /** As CSS writes it; for a relation, the anchor's own state (`:hover`, or `""`). */
  text: string
  /** The relation read, by name. */
  relation?: string
  placement?: "within" | "after" | "before"
}

/** Where in a `recipe()` an entry is declared. */
export type RecipePart = {
  slot?: string
  /** None for the base, one for a variant option, every option of a compound variant. */
  options: Record<string, string>
  compound: boolean
}

/** One question for `Driver.trace`. */
export type TraceQuery = {
  /** Relative to the project root, or absolute. */
  file: string
  /** 1-based. */
  line: number
  /** As CSS writes it or as a style object does (`justifyContent`). */
  property: string
}

/** One entry of a trace, strongest first. */
export type TraceEntry = {
  value: string
  conditions: ConditionInfo[]
  layer: "kirana.atoms" | "kirana.contextual"
  /** A pseudo-element or a `select` target (`> svg`). */
  target?: string
  class: string
  part?: RecipePart
  /**
   * The ladder step that ranks this entry above the next, or 0 where a recipe's merge decides (a
   * later part of one slot replaces an entry of the same key); absent for the last.
   */
  step?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Why this entry beats the next; `""` for the last. */
  reason: string
}

export type TraceAnswer = {
  file: string
  line: number
  property: string
  /** Empty when nothing on the line sets the property. */
  entries: TraceEntry[]
  /** Why the file could not be traced. */
  error?: string
}

/** One entry of a handle's definition: a declaration, or a removal (`value: null`). */
export type DefinitionEntry = {
  property: string
  value: string | null
  /** `null` only for a removal under every condition (`property: null`). */
  conditions: ConditionInfo[] | null
  target?: string
  /** Variable tokens the value reads, by identity. */
  tokens?: string[]
  /** The variable token whose custom property the entry assigns. */
  assigns?: string
  keyframes?: string[]
  class?: string
}

export type Definition = {
  entries: DefinitionEntry[]
  /** Relations an element with this style anchors, by name. */
  anchors?: string[]
}

/** What `kirana-style export` prints (KRN-DX-011); `styles` and recipes' `parts` with definitions. */
export type DesignSystemExport = {
  schema: number
  engine: string
  prefix: string
  tokens: {
    identity: string
    /** Absent for a file outside any package. */
    package?: string
    value: string
    light?: string
    dark?: string
    variable: boolean
    origin: string
  }[]
  themes: { name: string; origin: string; class: string; overrides: string[] }[]
  recipes: {
    name: string
    origin: string
    slots?: string[]
    variants: Record<string, string[]>
    defaults: Record<string, string>
    compoundVariants: number
    parts?: (RecipePart & Definition)[]
  }[]
  relations: {
    name: string
    declaredIn: string[]
    anchoredIn: string[]
    readIn: string[]
  }[]
  keyframes: { name: string; origin: string; css: string }[]
  positionTries: { name: string; origin: string; css: string }[]
  viewTransitions: { name: string; origin: string; css: string }[]
  counterStyles: { name: string; origin: string; css: string }[]
  styles?: ({ name: string; origin: string } & Definition)[]
}

/** A Tailwind class string lowered as `kirana-style migrate tailwind` lowers a `className`. */
export type TailwindLowering = {
  /** The `css()` call; `null` when nothing in the string sets a value. */
  style: string | null
  /** A module holding it as `styles.style`, with what it imports and declares, and `const sx`. */
  module: string
  /** Relations the element anchors, by identifier: apply `<identifier>.anchor`. */
  anchors: string[]
  /** Utilities left out, each with the reason. */
  left: string[]
  notes: string[]
}

/** The UTF-16 index (a JavaScript string index) of a UTF-8 byte offset into `source`. */
export function utf16Offset(source: string, byteOffset: number): number {
  return Buffer.from(source).subarray(0, byteOffset).toString().length
}
