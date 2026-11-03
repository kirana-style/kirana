---
title: Migrating from styled-components
description: From styled-components or Emotion. A styled component becomes a handle and a component that takes sx; the codemod rewrites the rest and reports what it will not guess.
section: migration
order: 3
keywords:
  [
    styled-components,
    emotion,
    css-in-js,
    migration,
    codemod,
    styled,
    css prop,
    keyframes,
  ]
---

# Migrating from styled-components

styled-components and Emotion (this page covers both) build your CSS while the page renders: each style
is serialised, hashed and injected on the server, then again in the browser, and
the work grows with every component on the page. Kirana does that work in the
build. What you write stays close: styles in JavaScript, next to the component,
typed, with conditions inside them.

## The shift, in four lines

1. **A handle, not a component.** `styled.button` made a component with styles
   inside it. In Kirana the styles are a `css()` handle, and the component applies
   it with `sx`.
2. **Conditions nest inside values.** `&:hover { color: red }` becomes
   `color: { ":hover": "red" }`.
3. **Props choose handles.** ``${(p) => p.$quiet && css`…`}`` becomes a second
   handle, listed in `sx` when `$quiet` is set.
4. **No theme at runtime.** A `ThemeProvider` theme becomes
   [tokens](/docs/tokens/overview), read where they are used.

## The mapping

| styled-components / Emotion              | Kirana                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `` styled.button`…` ``                   | `const buttonStyle = css({ … })` and a component that takes `sx`              |
| `` styled(Link)`…` ``                    | the same, rendering `<Link sx={…}>`                                           |
| `` css`…` ``, `css({ … })`               | `css({ … })`                                                                  |
| `` keyframes`…` ``                       | [`keyframes({ … })`](/docs/styling/animation)                                 |
| `&:hover`, `&[aria-current]`, `@media …` | [conditions](/docs/styling/conditions) inside each property                   |
| `&::before`                              | a `"::before"` block                                                          |
| `& > svg`, `& svg`                       | [`select.child("svg")`, `select.descendant("svg")`](/docs/styling/contextual) |
| `${mixin}`                               | an entry of `sx`: `sx={[mixin, style, sx]}`                                   |
| `width: ${(p) => p.$w}px`                | ``css({ width: `${$w}px` })`` in the component's `sx`                         |
| `.attrs({ rel: "noreferrer" })`          | `rel="noreferrer"` on the element                                             |
| Emotion's `css` prop, `className={css…}` | `sx`                                                                          |
| `cx(a, b)`, `css(a, b)`                  | `sx={[a, b]}`                                                                 |
| `ThemeProvider`, `useTheme`              | tokens and themes, no provider                                                |
| `createGlobalStyle`, `Global`            | a stylesheet                                                                  |

## What a styled component becomes

This styled component:

```tsx
export const Button = styled.button<{ $quiet?: boolean }>`
  padding: 8px 16px;
  &:hover {
    background-color: #f4f4f5;
  }
  ${(p) =>
    p.$quiet &&
    css`
      background-color: transparent;
    `}
`
```

becomes a handle per style and a component of the shape every Kirana component
has: it takes `sx`, passes its other props on, and applies the caller's `sx` last.

```tsx
const buttonStyle = css({
  padding: "8px 16px",
  backgroundColor: { ":hover": "#f4f4f5" },
})
const buttonQuiet = css({
  backgroundColor: "transparent",
})

export const Button = ({
  sx,
  ...props
}: { $quiet?: boolean } & ComponentProps<"button"> & { sx?: Sx }) => {
  const { $quiet, ...rest } = props
  return <button {...rest} sx={[buttonStyle, $quiet && buttonQuiet, sx]} />
}
```

Every place that renders `<Button $quiet>` keeps working, so you can migrate one
file at a time. `$quiet && buttonQuiet` chooses between two classes the build
already wrote; nothing is generated when it renders. A value only known at
runtime (`width: ${(p) => p.$w}px`) goes through a
[custom property](/docs/styling/dynamic) instead.

## Order

`sx` is merged in order, the later entry winning. A mixin or a block chosen by
props that you wrote **before** the declarations goes before the style, as it
did. One written **after** declarations now comes after the style and wins over
them; in your CSS the declarations below it won. The codemod reports each such
case.

`!important` is dropped and reported: Kirana's
[precedence ladder](/docs/styling/precedence) orders every rule, so it writes
none. Check what it was overriding.

## What does not carry over

- **The theme.** A function reading `p.theme` and the `ThemeProvider` around
  your app have no runtime counterpart. Declare the values as
  [tokens](/docs/tokens/overview), and a dark or brand variant as a
  [theme](/docs/tokens/themes-and-modes).
- **Component selectors** (`${Icon}:hover &`), **a class on the element itself**
  (`&.active`: Kirana's class names are hashes, so use a data attribute or a prop),
  and **sibling combinators** (`& + &`). Each stays beside the style as a
  comment.
- **Global styles.** `createGlobalStyle` and Emotion's `Global` go in a
  stylesheet. Kirana writes rules only for the elements that use a style.
- **`as`.** The component always renders its own element. Give the other
  element a component of its own with the same handles.
- **Refs.** The component passes `ref` on with its props, which React 19 does.
  On React 18, wrap it in `forwardRef`.
- **Props reaching the element.** `$` props never do. A prop without `$` that a
  style reads still does, as styled-components 6 passed it; Emotion dropped
  those that are not HTML attributes, so take any such prop out of `rest`.

## The codemod

> [!TIP] Porting with a coding agent
> The [`kirana-migrate` skill](/docs/project/agent-skills) gives an agent this
> page's process: the codemod and its report, the traps, and how to prove the
> port renders the same.

```bash
kirana-style migrate styled-components src          # print the diff and the report
kirana-style migrate styled-components src --write  # apply it
```

The command is also named `kirana-style migrate emotion`. Both read every file
that imports styled-components or one of Emotion's packages, and write nothing
without `--write`. A `.ts` file that gains a component is renamed `.tsx`, since
the component is JSX.

It leaves these alone, with a report, and keeps `styled` imported for them:

- `.withConfig()` and `styled()`'s options;
- `.attrs()` with a function;
- a style function with a body.

The names Kirana has no counterpart for, such as `ThemeProvider` and
`createGlobalStyle`, stay imported too. Everything else it would have to guess
is in the report, with the file and line, and in a comment beside the style it
belongs to.

Then build, and compare the result with the build you came from:
[verifying a migration](/docs/migration/conformance) compares computed styles,
element by element.
