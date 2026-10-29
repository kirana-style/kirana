<!-- Condensed from https://kirana.style/docs/migration/from-stylex.md; that page is the source of truth. -->

# StyleX to Kirana

| StyleX                                                              | Kirana                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `stylex.create({ … })`                                              | `css({ … })` per style, or an object of handles                                |
| `stylex.props(a, b)`                                                | `sx={[a, b]}` on your own elements; `styleProps(a, b)` on installed components |
| `stylex.defineVars({ … })`                                          | `defineTokens(namespace, { … }, { variable: true })`                           |
| `stylex.defineConsts({ … })`                                        | `defineTokens(namespace, { … })`                                               |
| `stylex.createTheme(vars, { … })`                                   | `defineTheme(tokens, { … })`                                                   |
| `stylex.keyframes({ … })`                                           | `keyframes({ … })`                                                             |
| `stylex.firstThatWorks(a, b)`                                       | `firstThatWorks(a, b)`                                                         |
| `stylex.positionTry({ … })`                                         | `positionTry({ … })`                                                           |
| `stylex.viewTransitionClass({ … })`                                 | `viewTransition({ … })`                                                        |
| `stylex.when.ancestor`, `siblingBefore`, `siblingAfter` and markers | `relation()`: `within`, `after`, `before`, and `rel.anchor`                    |
| `stylex.when.descendant`, `anySibling`                              | no equivalent: write a `:has()` condition                                      |
| `default:` inside a value                                           | `base:`                                                                        |
| `default: null`                                                     | omit the key (Kirana's `base: null` removes an earlier value)                  |
| `*.stylex.ts`, `*.stylex.js` files                                  | renamed to `*.ts`, `*.js` by the codemod, with the imports of them             |
| a bare number (`borderWidth: 10`, `transitionDuration: 150`)        | the unit StyleX gave it (`"10px"`, `"150ms"`), written by the codemod          |
| `marginHorizontal`, `start`, `borderTopStartRadius` …               | `marginInline`, `insetInlineStart`, `borderStartStartRadius` …                 |
| `float: "start"`                                                    | `float: "inline-start"`                                                        |
| a fallback array `["100vh", "100dvh"]`                              | `firstThatWorks("100dvh", "100vh")`                                            |
| `{ default, "@media (prefers-color-scheme: dark)" }` in a theme     | `{ light, dark }`                                                              |
| a condition block at the top of a style (`":hover": { color }`)     | inside each property: `color: { base, ":hover" }`                              |
| `!important`                                                        | none; the codemod reports it (the precedence ladder orders every rule)         |
| a selector with no condition (`":autofill + label"`)                | reported by the codemod: port it by hand                                       |
| a Flow file                                                         | strip its types first (`flow-remove-types`); the codemod cannot read Flow      |

## After the codemod

The codemod rewrites `{...stylex.props()}` to `sx`. Two passes are yours: an element you own given
`{...props(a, b)}` should take `sx={[a, b]}`, and a component from a package given `sx` needs
`{...styleProps(…)}`, because it never reads `sx` (`sx-on-external-component` finds them).

StyleX replaced a whole property; Kirana merges per entry. Ported code that overrides a component
with a plain value (`alignSelf: "auto"`) no longer beats the component's conditional entries: write
the override under the same condition, or drop the entries with `{ "*": null, base: … }`.

Then `kirana-style check`: it finds relations without anchors, components that swallow `sx`, and the
ambiguous pairs StyleX ordered silently.
