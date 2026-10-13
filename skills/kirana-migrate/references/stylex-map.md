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
| `*.stylex.ts` files                                                 | renamed to `*.ts` by the codemod                                               |

## After the codemod

The codemod rewrites `{...stylex.props()}` to `sx`. Two passes are yours: an element you own given
`{...props(a, b)}` should take `sx={[a, b]}`, and a component from a package given `sx` needs
`{...styleProps(…)}`, because it never reads `sx` (`sx-on-external-component` finds them).

StyleX replaced a whole property; Kirana merges per entry. Ported code that overrides a component
with a plain value (`alignSelf: "auto"`) no longer beats the component's conditional entries: write
the override under the same condition, or drop the entries with `{ "*": null, base: … }`.

Then `kirana check`: it finds relations without anchors, components that swallow `sx`, and the
ambiguous pairs StyleX ordered silently.
