# @kirana-style/core

The authoring API of [Kirana](../../../../spec/README.md), a compile-time styling system.
Every export here is compiled away by `@kirana-style/vite` (or the `kirana-style` CLI); calling one in code the
compiler did not see throws an error that says so. The normative reference is
[06-authoring-api](../../../../spec/06-authoring-api.md).

```tsx
import { css, relation } from "@kirana-style/core"
import { breakpoint, space } from "@kirana-style/preset-scales"

export const field = relation("field")

const styles = {
  root: css({
    display: "grid",
    gap: { base: space[2], [breakpoint.md]: space[3] },
  }),
  label: css({
    opacity: { base: 1, [field.within('[data-disabled="true"]')]: 0.5 },
  }),
}

export function Field({
  disabled,
  children,
}: {
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div data-disabled={disabled} sx={[field.anchor, styles.root]}>
      <label sx={styles.label}>{children}</label>
    </div>
  )
}
```

## Exports

| Export                                                                 | What it is                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `css(...styles)`                                                       | A style handle from style objects and other handles, merged in order                                     |
| `own(...attributes)`                                                   | Claims attributes the component writes itself (`"data-side"`), for the style built on it                 |
| `cx(...handles)`                                                       | Merges handles; `null`, `undefined` and `false` are skipped                                              |
| `props(...handles)`                                                    | `{ className, style }` for components that do not take `sx` (Base UI parts, render props)                |
| `recipe({ base, variants, compoundVariants, defaultVariants, slots })` | Variants; a call with static options compiles to a constant                                              |
| `relation(name)`                                                       | `anchor`, and the reads `within(state?)`, `after(state?)`, `before(state?)`                              |
| `select.descendant(target)`, `select.child(target)`                    | Contextual keys that style an element, class or attribute selector below; they lose to its own styles    |
| `keyframes(frames)`                                                    | A name usable as `animationName` from any module                                                         |
| `defineTokens(namespace, values, { variable? })`                       | Tokens; plain values inline, `variable: true` makes custom properties, `{ light, dark }` is a mode value |
| `defineTheme(tokens, overrides)`                                       | A handle that overrides variable tokens for a subtree                                                    |
| `mode.system`, `mode.light`, `mode.dark`                               | `color-scheme` handles for `<html>`                                                                      |
| `media(query)`, `container(query, name?)`, `supports(condition)`       | Condition values for computed keys                                                                       |
| `firstThatWorks(preferred, ...fallbacks)`                              | A value written once per member, the preferred last, for browsers that do not know it                    |
| `fallback(token, ...rest)`                                             | The first unset-by-default token an element sets, else the next, else the last value: one `var()` chain  |
| `positionTry(block)`                                                   | An `@position-try` rule's dashed ident, for `positionTryFallbacks`                                       |
| `viewTransition({ group, imagePair, old, new })`                       | A view-transition class: a handle for `sx` that is also the class name                                   |
| `counterStyle(descriptors)`                                            | An `@counter-style` rule's name, for `listStyleType` and `counter()`                                     |
| `Sx`, `Style`, `StyleHandle`, `Token` …                                | Types                                                                                                    |

Subpaths:

- `@kirana-style/core/react`: adds `sx` to React's element types: `/// <reference types="@kirana-style/core/react" />`.
- `@kirana-style/core/config`: `defineConfig` for `kirana.config.ts`.
- `@kirana-style/core/stylesheet.css`: the stylesheet entry. Import it once (`?url` for a `<link>`); the
  adapter fills it.
- `@kirana-style/core/internal`: the private runtime compiled modules import. Not for application code.

## Styles

- Properties are camelCase; custom properties are `"--name"`, or a variable token as a computed key.
- Conditions nest **inside** a property value: `color: { base: x, ":hover": y, [breakpoint.md]: z }`.
  A key may be a pseudo-class, an attribute selector, a compound of both (`"[aria-haspopup]:active"`),
  an at-rule string, or a condition value. Only pseudo-elements (`"::after"`) and `select.*` targets
  are top-level keys.
- Merging is per longhand and condition set: a later value replaces the entry with the same
  conditions and keeps the others. `{ base: null }` removes the base entry, `prop: null` the whole
  property, `{ "*": null, … }` everything not listed.
- Values known only at render time are fine in `css()` at the call site: a choice between static
  values becomes a class expression, anything else a custom-property bridge. No CSS is generated at
  runtime.

## Status

On npm at a 0.x version: before 1.0, a minor version may change the API. The package ships
JavaScript with its type declarations. See [the project status](https://kirana.style/docs/project/status).
