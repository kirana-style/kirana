<!-- Condensed from https://kirana.style/docs/migration/from-css-modules.md; that page is the source of truth. -->

# CSS Modules to Kirana

| CSS Modules                                            | Kirana                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `Button.module.css`                                    | `Button.styles.ts` beside it, one exported `css()` per class          |
| `.icon-only { … }`                                     | `export const iconOnly = css({ … })`                                  |
| `.button:hover`, `[data-busy]`, `@media …`             | conditions inside each property: `color: { ":hover": "red" }`         |
| `.button::after`                                       | a `"::after"` block                                                   |
| `.button > svg`, `.button svg`                         | `[select.child("svg")]`, `[select.descendant("svg")]`                 |
| `composes: base;`, `composes: a from "./b.module.css"` | `css(base, { … })`, `a` imported from `./b.styles`                    |
| `@keyframes spin`                                      | `export const spin = keyframes({ … })`                                |
| `import styles from "./Button.module.css"`             | `import * as styles from "./Button.styles"`                           |
| `className={styles.root}`                              | `sx={styles.root}`; `{...styleProps(styles.root)}` on a component     |
| `clsx(styles.a, on && styles.b, className)`            | `className={className} sx={[styles.a, on && styles.b]}`               |
| `const c = styles.root`                                | `styleProps(styles.root).className`                                   |
| `.card .title`                                         | a relation: `title` reads `card.within(…)`, `card` gets `card.anchor` |
| `:global(.x)`, `h1`, `@font-face`                      | a stylesheet                                                          |

- **Order.** CSS let the later rule in the file win between two classes on one element; `sx` lets the
  later entry win. The codemod reports each pair listed the other way: swap them in `sx`.
- **`.a.b`** cannot be ported as written: give the combination a class of its own.
- **A relative `url()`** no longer resolves: import the file and use its URL.
- **Sass, Less and Stylus modules** are not read: compile them to CSS first.
