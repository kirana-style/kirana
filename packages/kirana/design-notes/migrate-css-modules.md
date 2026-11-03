# `kirana-style migrate css-modules` (2026-11-03)

KRN-API-013's fourth codemod (D-121). It converts each CSS module among its paths into a module of
handles beside it, and rewrites the scripts that import one to read the handles. Like the others it
reports what it will not decide, and writes nothing without `--write`.

| Rewrites                                               | Into                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `Button.module.css`                                    | `Button.styles.ts` (`.js` with no `tsconfig.json` above it)               |
| `.icon-only { … }`                                     | `export const iconOnly = css({ … })`, as css-loader's camel case names it |
| `.button:hover`, `.button[data-busy]`, `@media …`      | conditions inside each property they set                                  |
| `.button::after`, `.button > svg`, `.button svg`       | a pseudo-element's block, `select.child`, `select.descendant`             |
| `&:hover` and `span` nested in a rule                  | the same, read as CSS nesting                                             |
| `composes: focusable from "./base.module.css"`         | `css(focusable, { … })`, imported from `./base.styles`                    |
| `@keyframes spin`                                      | `export const spin = keyframes({ … })`, read by name in `animation`       |
| `import styles from "./Button.module.css"`             | `import * as styles from "./Button.styles"`                               |
| `className={styles.root}`                              | `sx={styles.root}`; `{...styleProps(styles.root)}` on a component         |
| `clsx(styles.a, on && styles.b, className)`, templates | `className={className} sx={[styles.a, on && styles.b]}`                   |
| any other read (`const c = styles.root`)               | `styleProps(styles.root).className`, the class string it was              |

## Two passes

The command first converts every `*.module.css` among its paths, keeping what each holds (its
classes in the order the file names them, their exports, the properties each sets). Then each script
is rewritten against that: an import is resolved (relative, or through the project's aliases), and a
module that was not converted in the run is reported, not guessed at.

## Reading the CSS

The stylesheet is split by the same small parser as styled-components' templates (`css_text`), with no
placeholders in it. A selector is split into compounds. The first must hold exactly one class, and
its pseudo-classes and attributes become one condition key; a pseudo-element after it becomes a block.
One more compound after a descendant or child combinator becomes a `select` target, unless it holds a
class of the module (that is a relation, written by hand) or the first compound has a state (a
`select` target cannot wait for its parent's). Anything else is reported and kept as a comment at
the end of the module of handles.

The lifting into properties is the StyleX codemod's `place`: where several rules set a property under
the same conditions, the later one wins, as it did in the file.

## A component may not read `sx`

On an element, `className` becomes `sx` and any plain class names stay in `className`, which Kirana
merges. On a component, the codemod cannot know whether it takes `sx`, but every component that took
`className` still does: it gets `{...styleProps(…)}`, whose `className` is the compiled class string,
with the plain names among its arguments.

## Order

CSS chose between two classes on one element by their order in the file (at equal specificity); `sx`
chooses by the list. For each pair of the same module listed against the file's order that sets a
common property, the report names both classes and the properties. Specificity needs no report: a
rule with more conditions wins in Kirana too.

## Not carried

- **Global rules**: `:global`, element and id selectors, `@font-face`, `@import`, custom properties
  on `:root`. They belong in a stylesheet.
- **Two classes in one selector** (`.a.b`): give the combination a class of its own.
- **A class inside another** (`.card .title`): write the style on `.title` with a relation anchored
  on `.card`.
- **`!important`** is dropped. A relative `url()` is kept and reported: the stylesheet Kirana writes is
  not beside the CSS file, so the bundler no longer resolves it.
- **Sass, Less and Stylus modules** are not read: compile them to CSS first.
