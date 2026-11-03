<!-- Condensed from https://kirana.style/docs/migration/from-styled-components.md; that page is the source of truth. -->

# styled-components and Emotion to Kirana

| styled-components / Emotion                   | Kirana                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `` styled.button`…` ``, `styled("button")(…)` | `const buttonStyle = css({ … })` and a component that takes `sx`              |
| `` styled(Link)`…` ``                         | the same, rendering `<Link sx={…}>`; `{...styleProps(…)}` on an installed one |
| `` css`…` ``, `css({ … })`                    | `css({ … })`                                                                  |
| `` keyframes`…` ``, `keyframes({ … })`        | `keyframes({ … })`                                                            |
| `&:hover`, `&[aria-current]`, `@media …`      | conditions inside each property: `color: { ":hover": "red" }`                 |
| `&::before`                                   | a `"::before"` block                                                          |
| `& > svg`, `& svg`, `li`                      | `[select.child("svg")]`, `[select.descendant("svg")]`                         |
| `${mixin}`                                    | an entry of `sx`, before the style if it came before the declarations         |
| ``${(p) => p.$on && css`…`}``                 | a handle of its own: `sx={[style, $on && styleOn, sx]}`                       |
| `width: ${(p) => p.$w}px`                     | ``css({ width: `${$w}px` })`` in the component's `sx`                         |
| `.attrs({ rel: "noreferrer" })`               | `rel="noreferrer"` on the element                                             |
| Emotion's `css` prop, `className={css…}`      | `sx`                                                                          |
| `cx(a, b)`, `css(a, b)`                       | `sx={[a, b]}`                                                                 |
| `ThemeProvider`, `useTheme`, `p.theme`        | tokens (`defineTokens`) and themes (`defineTheme`), no provider               |
| `createGlobalStyle`, `Global`                 | a stylesheet                                                                  |

The component a styled component becomes:

```tsx
export const Button = ({
  sx,
  ...props
}: { $quiet?: boolean } & ComponentProps<"button"> & { sx?: Sx }) => {
  const { $quiet, ...rest } = props
  return <button {...rest} sx={[buttonStyle, $quiet && buttonQuiet, sx]} />
}
```

- **Order.** A mixin or a block of props written after declarations now wins over them; the codemod
  reports each one. Move it before them, or write the declarations into it.
- **`as`** is not carried: give the other element a component of its own with the same handles.
- **Refs** reach the element as a prop: React 19, or `forwardRef` on 18.
- **A prop without `$` that a style reads** still reaches the element. Emotion dropped the ones that
  are not HTML attributes; take those out of `rest`.
- **`&.active`** cannot be ported as a class (class names are hashes): use a data attribute
  (`'[data-active]'`) or a prop that chooses a handle.
