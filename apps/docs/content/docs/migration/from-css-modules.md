---
title: Migrating from CSS Modules
description: Each module becomes a module of handles beside it, and the scripts that import it read the handles; the codemod reports what CSS decided by file order.
section: migration
order: 4
keywords:
  [css modules, module.css, migration, codemod, composes, clsx, className]
---

# Migrating from CSS Modules

CSS Modules already give you what most of Kirana's output looks like: scoped
class names and a static stylesheet, with nothing running when the page renders.
What they do not give you is checking. A class that no element uses, a typo in a
property, rules whose winner depends on which file loaded first: CSS accepts all
of them. Kirana's styles are TypeScript, so the compiler and your editor see
them.

## The shift, in four lines

1. **A class is a handle.** `.root { … }` becomes `export const root = css({ … })`,
   and `styles.root` still names it.
2. **Rules nest inside values.** `.root:hover { color: red }` becomes
   `color: { ":hover": "red" }` in `root`.
3. **`className` becomes `sx`.** `sx={[styles.root, open && styles.open]}`.
4. **The list decides, not the file.** In CSS the later rule in the file won; in
   `sx` the later entry wins.

## The mapping

| CSS Modules                                | Kirana                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `Button.module.css`                        | `Button.styles.ts`, beside it                                                 |
| `.icon-only { … }`                         | `export const iconOnly = css({ … })`                                          |
| `.button:hover`, `.button[data-busy]`      | [conditions](/docs/styling/conditions) inside each property                   |
| `@media`, `@supports`, `@container`        | conditions too                                                                |
| `.button::after`                           | a `"::after"` block                                                           |
| `.button > svg`, `.button svg`             | [`select.child("svg")`, `select.descendant("svg")`](/docs/styling/contextual) |
| `composes: base;`                          | `css(base, { … })`                                                            |
| `@keyframes spin`                          | [`keyframes({ … })`](/docs/styling/animation), exported                       |
| `import styles from "./Button.module.css"` | `import * as styles from "./Button.styles"`                                   |
| `className={styles.root}`                  | `sx={styles.root}`                                                            |
| `clsx(styles.a, on && styles.b)`           | `sx={[styles.a, on && styles.b]}`                                             |
| `.card .title`                             | a [relation](/docs/styling/relations), by hand                                |
| `:global(.x)`, `h1`, `@font-face`          | a stylesheet                                                                  |

## What a module becomes

This module and the component that uses it:

```css
.button {
  composes: focusable from "./base.module.css";
  padding: 8px 16px;
}
.button:hover {
  background-color: #f4f4f5;
}
.primary {
  background-color: #18181b;
}
```

```tsx
<button className={clsx(styles.button, primary && styles.primary, className)} />
```

become a module of handles and the same component reading it:

```tsx
export const button = css(focusable, {
  padding: "8px 16px",
  backgroundColor: { ":hover": "#f4f4f5" },
})

export const primary = css({
  backgroundColor: "#18181b",
})
```

```tsx
<button className={className} sx={[styles.button, primary && styles.primary]} />
```

Three more things happen around it:

- A class name passed in from outside stays in `className`: Kirana merges it
  with what `sx` compiles to.
- On a component rather than an element, the codemod writes compiled props
  (`{...styleProps(…)}`): it cannot know whether the component reads `sx`, and
  every component that took `className` still does.
- Anywhere else a class was a string, it becomes the same string:
  `styleProps(styles.root).className`.

## Order

When an element has two classes that set the same property, CSS picked the rule
later in the file. `sx` picks the entry later in the list. The codemod reports
every pair listed the other way round: swap the two in `sx` if the old winner
should still win.

## What does not carry over

- **Global rules.** `:global(…)`, element and id selectors, `@font-face` and
  `@import` belong in a stylesheet. Each stays as a comment at the end of the
  module of handles.
- **Two classes in one selector** (`.button.primary`): give the combination a
  class of its own.
- **A class inside another** (`.card .title`): write the style on `title`, reading
  `card` through a [relation](/docs/styling/relations).
- **A descendant only in a state** (`.card:hover svg`): a `select` target cannot
  wait for its parent's state; use a relation.
- **`!important`** is dropped, since Kirana's
  [precedence ladder](/docs/styling/precedence) orders every rule.
- **Relative `url()`s** are kept and reported: the stylesheet Kirana writes is
  not beside your CSS file, so import the file and use its URL.
- **Sass, Less and Stylus modules** are not read. Compile them to CSS first.

## The codemod

> [!TIP] Porting with a coding agent
> The [`kirana-migrate` skill](/docs/project/agent-skills) gives an agent this
> page's process: the codemod and its report, the traps, and how to prove the
> port renders the same.

```bash
kirana-style migrate css-modules src          # print the diff and the report
kirana-style migrate css-modules src --write  # apply it
```

Pass the modules and the scripts that import them together: a module that is
not among the paths is reported where it is imported, not guessed at. Each
module is written as `.ts` when a `tsconfig.json` is above it, `.js` otherwise,
and the CSS file is removed. Everything it would have to guess is in the report,
with the file and line.

Then build, and compare the result with the build you came from:
[verifying a migration](/docs/migration/conformance) compares computed styles,
element by element.
