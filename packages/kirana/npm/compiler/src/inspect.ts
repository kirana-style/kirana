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

/** The UTF-16 index (a JavaScript string index) of a UTF-8 byte offset into `source`. */
export function utf16Offset(source: string, byteOffset: number): number {
  return Buffer.from(source).subarray(0, byteOffset).toString().length
}
