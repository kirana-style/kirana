---
title: API reference
description: Every export of @kirana-style/core, with its signature and what it returns.
kind: api
section: reference
order: 1
keywords:
  [
    api,
    reference,
    css,
    cx,
    props,
    recipe,
    relation,
    select,
    keyframes,
    defineTokens,
    defineTheme,
    mode,
    firstThatWorks,
    positionTry,
    viewTransition,
    counterStyle,
    media,
    container,
    supports,
  ]
---

# API reference

Everything below is exported from `@kirana-style/core`, and every one of them is
compiled away. Calling one in a module the compiler never saw throws an error that
says exactly that.

## `css(...styles)`

```ts
css(...styles: readonly (Style | Sx)[]): StyleHandle
```

Compiles style objects, and handles you already have, into one handle. Arguments
merge left to right. [Writing styles](/docs/styling/styles).

## `cx(...handles)`

```ts
cx(...handles: readonly Sx[]): StyleHandle
```

Merges handles, skipping `null`, `undefined` and `false`.
[Merging](/docs/styling/merging).

## `props(...handles)`

```ts
props(...handles: readonly (Sx | string)[]): { className?: string; style?: Record<string, string> }
```

The compiled props for a component that does not read `sx`. Conventionally
imported as `props as styleProps`.

In Solid, Preact and Qwik it returns `{ class, style }`, the attribute their JSX
takes, and that framework's type entry types it so.
[Styling other people's components](/docs/styling/external-components).

## `recipe(config)`

```ts
recipe({ slots?, base?, variants?, compoundVariants?, defaultVariants? }): Recipe
```

Variants and slots. A call with static options compiles to a constant; with a
runtime option it resolves through the runtime and reports `dynamic-variant`.
[Recipes](/docs/styling/recipes).

## `relation(name)`

```ts
relation(name: string, options?: { optional?: boolean }): {
  name: string
  anchor: StyleHandle
  within(state?: string): Condition
  parent(state?: string): Condition
  after(state?: string): Condition
  before(state?: string): Condition
}
```

Styling by another element's state. `optional: true` lets a reader be installed
without the component that applies the anchor, where the read never matches,
instead of failing `relation-without-anchor`.
[Relations](/docs/styling/relations).

## `select.descendant(target)` · `select.child(target)`

```ts
select.descendant(target: string): SelectTarget
select.child(target: string): SelectTarget
```

Top-level keys that style elements below this one, in a layer their own styles
beat. Targets are element names or attribute selectors.
[Contextual styles](/docs/styling/contextual).

## `keyframes(frames)`

```ts
keyframes(frames: Record<string, Properties & { [property: `--${string}`]: string | number }>): Keyframes
```

A name usable as `animationName` from any module.
[Animation](/docs/styling/animation).

## `firstThatWorks(preferred, ...fallbacks)`

```ts
firstThatWorks<V>(...values: [V, ...V[]]): Fallbacks<V>
```

A property value written once per value, the preferred last, so a browser that
does not understand it keeps the one before. Values must be known at build time
and expand to the same longhands. [Fallback values](/docs/styling/fallbacks).

## `positionTry(block)`

```ts
positionTry(block: PositionTryBlock): PositionTry
```

An `@position-try` rule and its dashed ident, for `positionTryFallbacks`. The
block takes inset, margin, size, self-alignment, `positionAnchor` and
`positionArea`; anything else is reported.
[Anchor positioning](/docs/styling/anchor-positioning).

## `viewTransition(parts)`

```ts
viewTransition(parts: { group?, imagePair?, old?, new?: TransitionStyle }): ViewTransition
```

Styles for a view transition's pseudo-elements. The result is a style handle for
`sx` and, at once, the `view-transition-class` name a framework's transition API
takes. [View transitions](/docs/styling/view-transitions).

## `counterStyle(descriptors)`

```ts
counterStyle(descriptors: CounterStyleDescriptors): CounterStyle
```

An `@counter-style` rule and its name, for a list's marker or a counter. The
keys are the CSS descriptors, written as CSS text. An unknown descriptor, a
custom property or a system without the symbols it needs is reported.
[At-rules](/docs/styling/at-rules#counter-styles).

## `defineTokens(namespace, values, options?)`

```ts
defineTokens(namespace: string, values: TokenValues, options?: { variable?: boolean }): Tokens
```

A token group. Values may be a plain value, `{ light, dark }`, `{ value, variable }`,
or `{ value, syntax, inherits? }` to register an animatable custom property.
[Tokens](/docs/tokens/overview).

## `defineTheme(tokens, overrides)`

```ts
defineTheme(tokens: Tokens, overrides: ThemeOverrides): StyleHandle
```

A handle that overrides variable tokens for a subtree.
[Themes and modes](/docs/tokens/themes-and-modes).

## `mode.system` · `mode.light` · `mode.dark`

Handles that set `color-scheme`. Apply to the root element.

## `media(query)` · `container(query, name?)` · `supports(condition)`

```ts
media(query: string): Condition
container(query: string, name?: string): Condition
supports(condition: string): Condition
```

Condition values for computed keys. [Conditions](/docs/styling/conditions).

## Types

| Type                  | What it is                                                                              |
| --------------------- | --------------------------------------------------------------------------------------- |
| `StyleHandle`         | A compiled style. Opaque.                                                               |
| `Sx`                  | `StyleHandle \| null \| undefined \| false \| readonly Sx[]`: what `sx` and `cx` accept |
| `Style`               | A style object: CSS properties, custom properties, pseudo-elements, `select` targets    |
| `ConditionalValue<V>` | `{ base?: V, [condition]: V \| ConditionalValue<V> }`                                   |
| `Condition`           | A condition value, from `media`/`container`/`supports` or a relation read               |
| `SelectTarget`        | A contextual target, from `select.*`                                                    |
| `Token`, `Keyframes`  | A token's CSS text; a keyframes name                                                    |
| `PositionTry`         | An `@position-try` rule's dashed ident                                                  |
| `Fallbacks<V>`        | A `firstThatWorks()` run of values `V`                                                  |
| `ViewTransition`      | A `viewTransition()` class: a `StyleHandle` that is also its class name                 |

## Entry points

| Import                              | What it gives                                 |
| ----------------------------------- | --------------------------------------------- |
| `@kirana-style/core`                | the API above                                 |
| `@kirana-style/core/config`         | `defineConfig` for `kirana.config.ts`         |
| `@kirana-style/core/react`          | the `sx` prop's types                         |
| `@kirana-style/core/stylesheet.css` | the stylesheet entry                          |
| `@kirana-style/core/internal`       | the private runtime, not for application code |
