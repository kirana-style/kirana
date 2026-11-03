# `kirana-style migrate styled-components` (2026-11-03)

KRN-API-013's third codemod (D-120), for the two runtime CSS-in-JS libraries: styled-components and
Emotion (`@emotion/styled`, `@emotion/react`, `@emotion/css`). The command is also named `emotion`.
Like the other two it rewrites the mechanical half of a migration and reports the rest, and writes
nothing without `--write`.

| Rewrites                                                                    | Into                                                                   |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `` styled.button`…` ``, `styled("button")`, `styled(Link)`, Emotion objects | a `css()` handle and a component that takes `sx` and applies it        |
| `.attrs({ rel: "noreferrer" })`                                             | attributes on the element, after the spread props, as `.attrs()` won   |
| a value read from props (`width: ${(p) => p.$w}px`)                         | a `css()` in the component's `sx`, reading `$w` from its props         |
| a block chosen by props (``${(p) => p.$on && css`…`}``)                     | a handle of its own, listed after the style: `$on && buttonOn`         |
| a mixin (`${center}`)                                                       | an entry of the component's `sx`                                       |
| `&:hover`, `&[data-x]`, `@media …` blocks                                   | conditions inside each property they set                               |
| `&::before`, `& > svg`, `li`                                                | a pseudo-element's block, `select.child`, `select.descendant`          |
| `` css`…` ``, `css({…})`, `` keyframes`…` ``, `keyframes({…})`              | Kirana's `css` and `keyframes`                                         |
| Emotion's `css` prop, `className={css…}`, `cx(a, b)`, `css(a, b)`           | `sx` (`{...styleProps()}` on an installed package's component), arrays |

## What a styled component becomes

A Kirana component takes `sx` and applies it last (`styling/sx.md`); that is the whole target:

```tsx
const buttonStyle = css({
  padding: "8px 16px",
  backgroundColor: { ":hover": "#f4f4f5" },
})
const buttonQuiet = css({ backgroundColor: "transparent" })

export const Button = ({
  sx,
  ...props
}: { $quiet?: boolean } & ComponentProps<"button"> & { sx?: Sx }) => {
  const { $quiet, ...rest } = props
  return <button {...rest} sx={[buttonStyle, $quiet && buttonQuiet, sx]} />
}
```

Every call site stays as it was, `$` props included, so a project migrates a file at a time. The `$`
props a style reads, and those the component's type declares, are taken out of what reaches the
element, as styled-components does. A prop without `$` that a style reads still reaches the element:
styled-components 6 passes every prop, and Emotion passed only those that are HTML attributes, a list
the codemod does not have.

The component is JSX, so a `.ts` file that gains one is renamed `.tsx`; a JavaScript file gets the
same component without types. A component styled from an installed package (resolved through the
project, as `migrate tailwind` does) does not read `sx`, so it gets `{...styleProps(…)}` instead.

## Reading a template

A template's CSS is joined into one string with each `${…}` replaced by a placeholder: the
expression's index between U+FDD0 and U+FDD1, two Unicode noncharacters, so no text the author wrote
can be mistaken for one (an icon font's private-use glyph can sit in a `content` value). A small
parser of the codemod's own splits that string into declarations, nested blocks, interpolations alone
on their line, and text it cannot read. It needs no more: it never evaluates CSS, only finds where a
statement ends (`;`, `{`, `}` outside strings and parentheses, so a `data:` URL with `;` survives).
Comments of both kinds are skipped, as both libraries strip them.

A value's placeholders are written back as JavaScript: one placeholder alone is its expression
(`boxShadow: shadow`), anything else a template literal (`` `1px solid ${color}` ``). A function's
parameter is rewritten to the component's props: `p.$x` and a destructured `$x` become the `$x` the
component takes out, any other `p.x` becomes `props.x`. A function that reads `theme`, renames a prop,
gives it a default, or holds anything the codemod does not read is reported, never guessed.

Nested blocks are lifted into the properties they set, as `migrate stylex` lifts StyleX's condition
blocks, through the same `place` and `Piece`. Where several blocks set a property, a later one
wins, as it did in CSS.

## Order

Kirana merges an `sx` array by entry, later winning. Two things in a template had their order from
the CSS instead:

- a mixin or a block chosen by props written **before** any declaration goes before the style, which
  overrides it, as in the source;
- one written **after** declarations goes after the style and now wins over them. If declarations
  follow it, the codemod reports it: in the source they won.

`!important` is dropped and reported, since Kirana writes none.

## Not carried

- **The theme.** `ThemeProvider`, `useTheme` and a function reading `theme` have no counterpart: a
  theme is tokens (`defineTokens`, `defineTheme`), read where they are used.
- **Selectors Kirana takes no condition for**: a component selector (`${Icon}:hover &`), a class on
  the element itself (`&.active`, since class names are hashes), sibling combinators, a descendant
  only in a state of the parent (`&:hover svg`). Each stays as a comment beside the style.
- **Global styles.** `createGlobalStyle`, `injectGlobal` and `Global` stay imported: Kirana writes
  rules only for elements that use a style.
- **`as`.** The component renders its own element. An `as` passed to a migrated component in the same
  file is reported; elsewhere it is not seen.
- **Refs.** The component passes `ref` on with its props, which React 19 does; on React 18 wrap it in
  `forwardRef`.
- **`.withConfig()`, `styled()`'s options, `.attrs()` with a function, a style function with a body**
  are left as they are, and `styled` stays imported for them.
