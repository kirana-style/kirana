<!-- Condensed from https://kirana.style/docs/reference/api.md; that page is the source of truth. -->

# @kirana-style/core API

Every export is compiled away. Calling one in a module the compiler never saw throws an error that
says so: the file is not under the bundler plugin, or not in the paths given to the CLI.

## Styles

```ts
css(...styles: (Style | Sx)[]): StyleHandle      // merges left to right
cx(...handles: Sx[]): StyleHandle                // skips null, undefined, false
own(...attributes: string[]): StyleHandle        // claims attributes the component writes: css(own("data-side"), {...})
props(...handles: (Sx | string)[]): { className?, style? }  // import { props as styleProps }
                                                 // { class?, style? } in Solid, Preact and Qwik
```

```tsx
import { css } from "@kirana-style/core"

const styles = {
  card: css({
    display: "grid",
    gap: "1rem",
    padding: { base: "1rem", [media("(min-width: 48rem)")]: "1.5rem" },
    borderColor: {
      base: color.border,
      ":hover": color.ring,
      "[data-selected]": color.primary,
    },
    "::after": { content: '""' },
  }),
}
export function Card({ sx, ...props }: { sx?: Sx }) {
  return <div sx={[styles.card, sx]} {...props} />
}
```

A helper that returns a value or a style object folds at build time when its inputs are static:
default parameters, optional values, `in`, token comparisons, and `Object.entries`,
`Object.fromEntries` and `.map()` with a callback written in place. Passing a plain object built
from data to `css()` is `not-evaluable`.

A conditional value is `{ base?, [condition]: value | nested conditional }`. Condition keys are
pseudo-classes (`":hover"`), attribute selectors (`'[data-state="open"]'`), at-rule strings
(`"@media (…)"`) or computed conditions (`[media(q)]`, `[container(q, name?)]`, `[supports(c)]`,
relation reads). A headless part's states come typed from `@kirana-style/states`:
`[Switch.Root.checked]` is `"[data-checked]"`, `[Select.Popup.side.bottom]` is
`'[data-side="bottom"]'` (`import { Select, Switch } from "@kirana-style/states/base-ui"`); prefer
them to hand-typed attributes for Base UI parts, and likewise `@kirana-style/states/ark-ui`
(`Switch.Root.state.checked`), `/react-aria` (`Button.focusVisible`), `/reka-ui` and `/bits-ui`
(`Switch.Root.state.checked`) and `/ng-primitives` (`Switch.Root.checked`). Each exports `exclusive`
for `conditions: { exclusive }` in `kirana.config`, so `checked` and `unchecked` on one property are
not `ambiguous-precedence`. Nesting two conditions means both must match, and
the nested one wins.
`"*": null` drops every earlier entry of a property; `base: null` drops the base entry only.

## Variants

```ts
recipe({ slots?, base?, variants?, compoundVariants?, defaultVariants? }): Recipe
```

```tsx
const button = recipe({
  base: { display: "inline-flex", borderRadius: "0.5rem" },
  variants: {
    tone: { solid: { backgroundColor: "black", color: "white" }, quiet: { backgroundColor: "transparent" } },
    size: { sm: { paddingInline: "0.5rem" }, md: { paddingInline: "0.875rem" } },
  },
  compoundVariants: [{ tone: "quiet", size: "sm", css: { paddingInline: "0.375rem" } }],
  defaultVariants: { tone: "solid", size: "md" },
})
<button sx={button({ tone: "quiet" })} />   // static options: compiled to a class string
<button sx={button({ tone: props.tone })} /> // runtime option: resolved at runtime (dynamic-variant)
```

With `slots: ["root", "label"]`, `base` and each option hold one style per slot, and a call returns
`{ root, label }` handles.

## Relations and contextual styles

```ts
relation(name, { optional? }): { name, anchor: StyleHandle, within(state?), parent(state?), after(state?), before(state?) }
select.descendant(target) · select.child(target)
```

```tsx
const field = relation("field")
<div sx={[field.anchor, styles.field]}>
  <label sx={css({ opacity: { [field.within('[data-disabled="true"]')]: 0.5 } })} />
</div>
// within: the anchor is an ancestor (Tailwind group-*); parent: the direct parent (*:, from the
// child); after: an earlier sibling (peer-*); before: a later sibling. The element's own state is a
// plain key ('[data-disabled="true"]'), never a read through the anchor it carries.
// relation("field", { optional: true }): a reader installed without the anchor's component (a
// registry item) never matches, instead of failing relation-without-anchor.

css({ [select.descendant("svg")]: { width: "1rem", height: "1rem" } })
// ranks below the svg's own styles, so an icon that sets its size keeps it.
```

## Tokens, themes and modes

```ts
defineTokens(namespace, values, options?: { variable?: boolean }): Tokens
defineTheme(tokens, overrides): StyleHandle
mode.system · mode.light · mode.dark   // handles that set color-scheme; put one on <html>
```

```ts
export const color = defineTokens(
  "color",
  {
    background: "light-dark(#fff, #09090b)",
    primary: "light-dark(oklch(0.21 0.006 285), oklch(0.92 0.004 286))",
  },
  { variable: true }
)
export const space = defineTokens("space", { 2: "0.5rem", 4: "1rem" })
export const ocean = defineTheme(color, {
  primary: "light-dark(#0369a1, #7dd3fc)",
})
// <section sx={ocean}> overrides `primary` for that subtree.
```

A token value may also be `{ light, dark }` (a non-colour per mode), `{ value, variable }`, or
`{ value, syntax, inherits? }` to register an animatable custom property (`@property`).
`@kirana-style/preset-scales` provides Tailwind v4's scales as tokens (`space[4]`, `color.zinc500`,
`breakpoint.md`); a token nothing reads emits nothing. Its utility grammar, which lets `sx` take a
string (`sx="px-4 text-sm"`), is the default export of the `/preset` entry:
`import scales from "@kirana-style/preset-scales/preset"`, then `presets: [scales()]` in
`kirana.config.ts`.

## Definitions

```ts
keyframes(frames): Keyframes                     // use as animationName
firstThatWorks(preferred, ...fallbacks)          // minHeight: firstThatWorks("100dvh", "100vh")
positionTry(block): PositionTry                  // an @position-try rule's dashed ident
viewTransition({ group?, imagePair?, old?, new? }): ViewTransition
counterStyle(descriptors): CounterStyle          // an @counter-style rule's name: listStyleType, counter()
```

- `firstThatWorks` values must be static and expand to the same longhands; on a custom property
  use `var(--x, fallback)` instead.
- `positionTry` blocks take only inset, margin, size, self-alignment, `positionAnchor` and
  `positionArea`. List the result in `positionTryFallbacks`.
- A `viewTransition` result is a handle for `sx` and also the `view-transition-class` name to hand
  a framework's transition API. Kirana never sets `view-transition-name`: it must be unique per
  element, so set it from your data. Parts accept `media()`/`supports()` conditions only.
- `counterStyle` keys are the CSS descriptors in camel case, values CSS text (`symbols: '"✓"'`).
  No `var()` in a descriptor; `fallback` and `` system: `extends ${other}` `` take another counter
  style. `@font-face` and `@page` stay in a stylesheet; a named media query is a `media()` constant.

## Types and entry points

`StyleHandle` (opaque), `Sx` (`StyleHandle | null | undefined | false | readonly Sx[]`), `Style`,
`ConditionalValue<V>`, `Condition`, `SelectTarget`, `Token`, `Keyframes`, `PositionTry`,
`Fallbacks<V>`, `ViewTransition`, `CounterStyle`.

| Import                               | Gives                                            |
| ------------------------------------ | ------------------------------------------------ |
| `@kirana-style/core`                 | the API above                                    |
| `@kirana-style/core/config`          | `defineConfig` for `kirana.config.ts`            |
| `@kirana-style/core/react`           | the `sx` prop's types                            |
| `@kirana-style/core/stylesheet.css`  | the stylesheet entry, imported once by the app   |
| `@kirana-style/states/base-ui`       | Base UI parts' states as condition keys          |
| `@kirana-style/states/ark-ui`        | Ark UI (Zag) parts' states as condition keys     |
| `@kirana-style/states/react-aria`    | React Aria components' states as condition keys  |
| `@kirana-style/states/reka-ui`       | Reka UI (Vue) parts' states as condition keys    |
| `@kirana-style/states/bits-ui`       | Bits UI (Svelte) parts' states as condition keys |
| `@kirana-style/states/ng-primitives` | Angular Primitives' states as condition keys     |
