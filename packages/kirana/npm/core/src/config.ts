/**
 * `kirana.config.ts` ([11-integrations](../../../../spec/11-integrations.md#configuration)).
 * The Driver loads the file once and hands the engine plain data (KRN-CMP-013).
 */

type Level = "off" | "info" | "warning" | "error"

/** One export of one module holding a scale's values: `{ module: "@kirana-style/preset-scales", export: "space" }`. */
export type ScaleSource = { readonly module: string; readonly export: string }

/** What one utility root sets (`design-notes/utility-surface.md`). */
export type UtilityRule =
  /** The root alone: `flex` → `{ display: "flex" }`. */
  | { readonly static: Readonly<Record<string, string>> }
  /** Values from a scale or a number: `p-4` → `{ padding: space[4] }`, `z-1` → `{ zIndex: "1" }`. */
  | {
      readonly properties: readonly string[]
      /** The scale keys come from; a rule with only `number` takes numbers alone. */
      readonly scale?: string
      /** A number that is not a key: `step` times it, then `unit` (`w-50` → 50 × 0.25rem). */
      readonly number?: { readonly step?: number; readonly unit?: string }
      /** Properties set from other scales at the same key: `text-sm` also sets its line height. */
      readonly pair?: Readonly<Record<string, string>>
      /** A colour: `/90` mixes it with `transparent`. */
      readonly alpha?: boolean
      /** `-mt-2` negates the value. */
      readonly negative?: boolean
      /** The value inside other text: `brightness({value})`; `{scale.key}` names a token. */
      readonly format?: string
      /** `w-1/2` is a percentage. */
      readonly fractions?: boolean
      /** Utility keys spelled differently from the scale's: `in-out` → `inOut`. */
      readonly aliases?: Readonly<Record<string, string>>
      /** Declarations set alongside, as written. */
      readonly also?: Readonly<Record<string, string>>
    }
  /** Values from a fixed table: `items-center` → `{ alignItems: "center" }`. */
  | {
      readonly properties: readonly string[]
      readonly values: Readonly<Record<string, string>>
      readonly also?: Readonly<Record<string, string>>
    }

/** A utility grammar: data a preset declares and the compiler interprets (KRN-API-012). */
export type UtilityGrammar = {
  /** Scale name → the modules exporting it, searched in order. */
  readonly scales?: Readonly<Record<string, readonly ScaleSource[]>>
  /** Utility root → alternatives, tried in order. */
  readonly utilities?: Readonly<Record<string, readonly UtilityRule[]>>
  /** Variant name → the condition key `css()` accepts (`:hover`, `@media (width >= 48rem)`). */
  readonly variants?: Readonly<Record<string, string>>
}

/** A preset: data only — its tokens are imported as modules; its grammar is declared here (KRN-TOK-008). */
export type Preset = {
  readonly name: string
  readonly utilities?: UtilityGrammar
}

export type KiranaConfig = {
  /**
   * Presets, applied in order (KRN-TOK-008). Their utility grammars are merged root by root, later
   * presets over earlier ones, and this configuration's own `utilities` last.
   */
  readonly presets?: readonly Preset[]
  /**
   * The project's own additions to the utility grammar — for example its semantic colours:
   * `{ scales: { color: [{ module: "./src/theme.ts", export: "theme" }, …] } }`. A relative `module`
   * is resolved from the project root.
   */
  readonly utilities?: UtilityGrammar
  /** Browser targets; the default floor is Chrome 123, Safari 17.5, Firefox 120. */
  readonly targets?: {
    readonly chrome?: number | string
    readonly safari?: number | string
    readonly firefox?: number | string
  }
  /** Layers placed before and after the `kirana` layer. */
  readonly layers?: {
    readonly before?: readonly string[]
    readonly after?: readonly string[]
  }
  readonly dynamic?: { readonly branchBudget?: number }
  readonly names?: { readonly prefix?: string }
  /**
   * Installed Kirana libraries this application compiles as it compiles its own modules: a published
   * library ships its `css()` calls uncompiled, and its styles take this application's prefix,
   * targets and layers, deduplicated with its own (KRN-INT-008).
   */
  readonly libraries?: readonly string[]
  /**
   * Which attribute `sx` compiles to: `className` for React, `class` for Preact, Solid and Qwik. Default:
   * detected from `compilerOptions.jsxImportSource` in the project's `tsconfig.json`, else React.
   */
  readonly jsx?: "react" | "preact" | "solid" | "qwik"
  /** Re-level warnings and infos by name. */
  readonly diagnostics?: Readonly<Record<string, Level>>
  readonly conditions?: {
    /**
     * Groups of conditions no two of which match one element at once, known from a library's
     * contract rather than from the selectors (`[data-starting-style]` and `[data-ending-style]`).
     * `ambiguous-precedence` treats them as exclusive.
     */
    readonly exclusive?: readonly (readonly string[])[]
    /**
     * One vocabulary per library a design system writes its components for (`exclusiveAcross()`
     * from `@kirana-style/states`): a component is built on one library, so two conditions no
     * vocabulary holds together are exclusive.
     */
    readonly exclusiveAcross?: readonly (readonly string[])[]
  }
  /**
   * The class map for server templates (D-069): Blade, ERB, HEEx, Twig and Edge templates name the
   * handles these modules export, and `kirana-style build` and `kirana-style dev` write their class strings to
   * `out` as JSON for the template helpers.
   */
  /**
   * Specifier prefixes the bundler provides and Node.js resolution cannot find — Ember's `@ember/`
   * and `@glimmer/`, which `@kirana-style/ember` adds. Imports from them are runtime values, without an
   * `unresolved-import` warning.
   */
  readonly externals?: readonly string[]
  readonly classes?: {
    /** Files or directories, relative to the root, whose exported handles templates use. */
    readonly modules: readonly string[]
    /** The class map file, relative to the root (`public/kirana/classes.json`). */
    readonly out: string
  }
}

/** Identity helper that types a configuration object. */
export function defineConfig(config: KiranaConfig): KiranaConfig {
  return config
}
