/**
 * The Kirana authoring API ([06-authoring-api](../../../../spec/06-authoring-api.md)).
 *
 * Every function here is compiled away: the Kirana compiler replaces each call with a class
 * string, a runtime handle or a plain value. The functions below only run when a module was not
 * compiled, and then they throw, because a style that silently does nothing is the failure
 * Kirana exists to remove (P6).
 */

import type * as CSS from "csstype"

declare const brand: unique symbol

/** A compiled style handle. */
export type StyleHandle = { readonly [brand]: "StyleHandle" }

/** What `sx` and `cx()` accept: handles, nested arrays, and skipped values. */
export type Sx = StyleHandle | null | undefined | false | readonly Sx[]

/** A condition usable as a computed key: `media()`, `container()`, `supports()`, relation reads. */
export type Condition = string & { readonly [brand]: "Condition" }

/** A contextual target usable as a computed key: `select.descendant()` / `select.child()`. */
export type SelectTarget = string & { readonly [brand]: "SelectTarget" }

/** A token reference: its CSS text at runtime. */
export type Token = string & { readonly [brand]: "Token" }

/** A keyframes name usable as `animationName`. */
export type Keyframes = string & { readonly [brand]: "Keyframes" }

/** An `@position-try` rule's dashed ident, listed in `positionTryFallbacks` (KRN-API-018). */
export type PositionTry = string & { readonly [brand]: "PositionTry" }

declare const members: unique symbol

/** A `firstThatWorks()` run: the values a property tries, preferred first (KRN-API-017). */
export type Fallbacks<V = Primitive> = string & {
  readonly [brand]: "Fallbacks"
  readonly [members]?: V
}

declare const transition: unique symbol

/**
 * A view-transition class (KRN-API-019): a style handle for `sx`, and at the same time the class
 * name a framework's view-transition API takes.
 */
export type ViewTransition = StyleHandle &
  string & { readonly [transition]: "ViewTransition" }

type Primitive = string | number

/** A property value: a CSS value, `null` to remove, or a conditional value object. */
export type StyleValue<V = Primitive> =
  | V
  | Token
  | Keyframes
  | PositionTry
  | Fallbacks<V>
  | null
  | undefined
  | ConditionalValue<V>

/** `{ base?: value, [condition]: value | nested }` (KRN-CAS-004). */
export type ConditionalValue<V = Primitive> = {
  readonly base?: V | Token | null
  readonly [condition: string]:
    | V
    | Token
    | null
    | undefined
    | ConditionalValue<V>
}

type Properties = {
  readonly [P in keyof CSS.Properties<Primitive>]?: StyleValue<
    CSS.Properties<Primitive>[P]
  >
}

/**
 * A style object: CSS properties, plus string keys for custom properties (`"--gap"`), variable
 * tokens used as keys (`[ctx.gap]`), pseudo-elements (`"::after"`) and contextual targets
 * (`[select.descendant("svg")]`). The compiler validates every key (KRN-API-001).
 */
export type Style = Properties & {
  readonly [key: string]: StyleValue<Primitive> | Style
}

type Missing = never

function uncompiled(name: string): Missing {
  throw new Error(
    `Kirana: ${name}() ran without being compiled. Add Kirana's plugin to the bundler (or run \`kirana-style build\`) so this module is compiled; if it comes from an installed library, list the package in \`libraries\` in kirana.config.ts.`
  )
}

/** Compiles styles into one handle (KRN-API-001). */
export function css(..._styles: readonly (Style | Sx)[]): StyleHandle {
  return uncompiled("css")
}

/** Merges handles in argument order (KRN-API-007). */
export function cx(..._handles: readonly Sx[]): StyleHandle {
  return uncompiled("cx")
}

/** `{ className, style }` for components and render-prop libraries that do not take `sx` (KRN-API-015). */
export function props(..._handles: readonly (Sx | string)[]): {
  className?: string
  style?: Record<string, string>
} {
  return uncompiled("props")
}

type Slotted<S extends string, T> = { readonly [K in S]?: T }
type SlotStyle<S extends string> = [S] extends [never]
  ? Style | Sx
  : Slotted<S, Style | Sx>

/** A recipe definition (KRN-API-006). */
export type RecipeConfig<
  V extends Record<string, Record<string, unknown>>,
  S extends string,
> = {
  readonly slots?: readonly S[]
  // Slot names come from `slots` alone: inferred from a style, they would be its property names.
  readonly base?: SlotStyle<NoInfer<S>>
  readonly variants?: {
    readonly [G in keyof V]: {
      readonly [O in keyof V[G]]: SlotStyle<NoInfer<S>>
    }
  }
  // Variants come from `variants` alone; the other two only name them.
  readonly compoundVariants?: NoInfer<
    readonly ({
      readonly [G in keyof V]?: VariantOption<V, G>
    } & { readonly css: SlotStyle<S> })[]
  >
  readonly defaultVariants?: NoInfer<{
    readonly [G in keyof V]?: VariantOption<V, G>
  }>
}

type VariantOption<V, G extends keyof V> = keyof V[G] extends infer O
  ? O extends "true" | "false"
    ? boolean | O
    : O
  : never

/** The options a recipe accepts. */
export type RecipeOptions<V> = {
  readonly [G in keyof V]?: VariantOption<V, G> | null
}

/** A compiled recipe. */
export type Recipe<V, S extends string> = (
  options?: RecipeOptions<V>
) => [S] extends [never] ? StyleHandle : { readonly [K in S]: StyleHandle }

export function recipe<
  const V extends Record<string, Record<string, unknown>> = {},
  const S extends string = never,
>(_config: RecipeConfig<V, S>): Recipe<V, S> {
  return uncompiled("recipe")
}

/** A declared relation between an anchor element and readers (KRN-API-010). */
export type Relation = {
  readonly name: string
  /** Apply to the element whose state is read. */
  readonly anchor: StyleHandle
  /** The reader is inside the anchor. */
  readonly within: (state?: string) => Condition
  /** The reader is a later sibling of the anchor. */
  readonly after: (state?: string) => Condition
  /** The reader is an earlier sibling of the anchor. */
  readonly before: (state?: string) => Condition
}

export function relation(_name: string): Relation {
  return uncompiled("relation")
}

/** Contextual descendant and child targets (KRN-CAS-006). */
export const select: {
  readonly descendant: (target: string) => SelectTarget
  readonly child: (target: string) => SelectTarget
} = {
  descendant: () => uncompiled("select.descendant"),
  child: () => uncompiled("select.child"),
}

export function keyframes(
  _frames: Readonly<Record<string, Properties>>
): Keyframes {
  return uncompiled("keyframes")
}

type TokenLeaf =
  | Primitive
  | Token
  | {
      readonly light: Primitive | Token
      readonly dark: Primitive | Token
      readonly variable?: boolean
    }
  | { readonly value: Primitive | Token; readonly variable?: boolean }
  | {
      /** The initial value. */
      readonly value: Primitive
      /**
       * Registers the custom property with `@property` so it can animate, as
       * `"<length-percentage>"`, `"<color>"` or any CSS syntax string.
       */
      readonly syntax: string
      /** Whether the property inherits; `true` unless set. */
      readonly inherits?: boolean
    }
  | {
      /**
       * The universal syntax may start unset: no initial value, and a reference
       * falls back to nothing (`var(--k…,)`), as Tailwind's filter steps do.
       */
      readonly syntax: "*"
      readonly inherits?: boolean
    }

/** Token values: leaves, mode objects, or nested groups. */
export type TokenValues = { readonly [key: string]: TokenLeaf | TokenValues }

/** The typed token group `defineTokens` returns (KRN-TOK-002). */
export type Tokens<T> = {
  readonly [K in keyof T]: T[K] extends TokenLeaf ? Token : Tokens<T[K]>
}

export function defineTokens<const T extends TokenValues>(
  _namespace: string,
  _values: T,
  _options?: {
    /** Emit every token of the group as a custom property (D-035). */
    readonly variable?: boolean
  }
): Tokens<T> {
  return uncompiled("defineTokens")
}

type ThemeOverrides<T> = {
  readonly [K in keyof T]?: T[K] extends Token
    ?
        | Primitive
        | Token
        | {
            readonly light: Primitive | Token
            readonly dark: Primitive | Token
          }
    : ThemeOverrides<T[K]>
}

/** A scoped theme overriding variable tokens (KRN-TOK-006). */
export function defineTheme<T>(
  _tokens: T,
  _overrides: ThemeOverrides<T>
): StyleHandle {
  return uncompiled("defineTheme")
}

/** Colour-scheme handles for the root element (KRN-TOK-005). */
export const mode: {
  readonly system: StyleHandle
  readonly light: StyleHandle
  readonly dark: StyleHandle
} = {
  get system(): StyleHandle {
    return uncompiled("mode.system")
  },
  get light(): StyleHandle {
    return uncompiled("mode.light")
  },
  get dark(): StyleHandle {
    return uncompiled("mode.dark")
  },
}

/**
 * Values to try in order, preferred first: `minHeight: firstThatWorks("100dvh", "100vh")`. The
 * property is written once per value, the preferred last, so a browser that does not understand it
 * keeps the one before (KRN-API-017).
 */
export function firstThatWorks<
  const V extends Primitive | Token | Keyframes | PositionTry,
>(..._values: readonly [V, ...V[]]): Fallbacks<V> {
  return uncompiled("firstThatWorks")
}

type PositionTryProperty =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "inset"
  | "insetBlock"
  | "insetBlockStart"
  | "insetBlockEnd"
  | "insetInline"
  | "insetInlineStart"
  | "insetInlineEnd"
  | "margin"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "marginBlock"
  | "marginBlockStart"
  | "marginBlockEnd"
  | "marginInline"
  | "marginInlineStart"
  | "marginInlineEnd"
  | "width"
  | "height"
  | "minWidth"
  | "minHeight"
  | "maxWidth"
  | "maxHeight"
  | "blockSize"
  | "inlineSize"
  | "minBlockSize"
  | "minInlineSize"
  | "maxBlockSize"
  | "maxInlineSize"
  | "alignSelf"
  | "justifySelf"
  | "placeSelf"
  | "positionAnchor"
  | "positionArea"

/** The declarations an `@position-try` block accepts: placement and size, nothing else. */
export type PositionTryBlock = {
  readonly [P in PositionTryProperty]?: Primitive | Token | Fallbacks
}

/**
 * An `@position-try` fallback for an anchored element (KRN-API-018). The result is a dashed ident
 * for `positionTryFallbacks`; the rule ships only where something references it.
 */
export function positionTry(_block: PositionTryBlock): PositionTry {
  return uncompiled("positionTry")
}

/** One pseudo-element of a view transition: properties, each plain or under `media()`/`supports()`. */
export type TransitionStyle = Properties

/**
 * Styles for the pseudo-elements of a view transition (KRN-API-019): `group`, `imagePair`, `old`
 * and `new`. Give an element the result in `sx` (or pass it where a framework wants a transition
 * class) and a unique `view-transition-name`; the parts then style that element's transition.
 */
export function viewTransition(_parts: {
  readonly group?: TransitionStyle
  readonly imagePair?: TransitionStyle
  readonly old?: TransitionStyle
  readonly new?: TransitionStyle
}): ViewTransition {
  return uncompiled("viewTransition")
}

/** `@media` condition. */
export function media(_query: string): Condition {
  return uncompiled("media")
}

/** `@container` condition, optionally for a named container. */
export function container(_query: string, _name?: string): Condition {
  return uncompiled("container")
}

/** `@supports` condition. */
export function supports(_condition: string): Condition {
  return uncompiled("supports")
}
