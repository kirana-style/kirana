<!-- Condensed from https://kirana.style/docs/tokens/overview.md, tokens/semantic-tokens.md and tokens/themes-and-modes.md; those pages are the source of truth. -->

# Tokens, themes and modes

A token is an imported constant: `defineTokens(namespace, values, options?)` returns a typed group,
and a style reads `space[2]` or `theme.primary`. The namespace must be unique in a package
(`token-namespace-collision`). A token nothing reads emits nothing.

## The kinds

| Kind               | Declared as                                                       | Compiles to                                           | Use for                                         |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Inlined            | `defineTokens("space", { 4: "1rem" })`                            | the literal value                                     | scales: spacing, radii, type, durations         |
| Variable           | the same with `{ variable: true }`                                | `var(--k…)`, the default in the `kirana.tokens` layer | the semantic layer, anything a theme changes    |
| One variable token | `{ value: "0.625rem", variable: true }` in a group                | `var(--k…)` for that token only                       | one themable value in an inlined group          |
| Colour pair        | `"light-dark(#fff, #09090b)"`                                     | one declaration for both schemes                      | every colour                                    |
| Per mode           | `{ light: "none", dark: "brightness(0.8)" }`                      | a value per mode                                      | what `light-dark()` cannot hold                 |
| Registered         | `{ value: "0%", syntax: "<length-percentage>", inherits: false }` | an `@property` rule                                   | a value a transition or keyframe animates       |
| Unset until set    | `{ syntax: "*", inherits: false }`, no value                      | a reference that falls back to nothing                | a chain an element fills in part (`fallback()`) |
| Read at runtime    | `{ runtime: true }` on the group or the token                     | always written, implies `variable`                    | a token code the compiler never sees reads      |

A production build (Vite, Rolldown) writes a variable token's declaration only when something reads
it; the dev server, `kirana-style check` and other bundlers write them all. `kirana-style analyze`
lists variable tokens nothing reads.

## One example of each layer

```ts
import {
  css,
  defineTheme,
  defineTokens,
  fallback,
  mode,
} from "@kirana-style/core"
import { color } from "@kirana-style/preset-scales"

// Scales: inlined.
export const space = defineTokens("space", { 2: "0.5rem", 4: "1rem" })

// Semantic: variable, every colour a pair, a non-colour per mode.
export const theme = defineTokens(
  "theme",
  {
    background: `light-dark(${color.white}, ${color.zinc[950]})`,
    primary: `light-dark(${color.zinc[900]}, ${color.zinc[50]})`,
    imageDim: { light: "none", dark: "brightness(0.8)" },
  },
  { variable: true }
)

// One themable value in an otherwise inlined group, and a value derived from it.
export const radius = defineTokens("radius", {
  base: { value: "0.625rem", variable: true },
  lg: "calc(0.625rem * 1.4)",
})

// Derived from a variable token: re-theme `theme.primary` and the tint follows.
export const alpha = defineTokens("alpha", {
  primary20: `color-mix(in oklab, ${theme.primary} 20%, transparent)`,
})

// Registered (animatable), and unset until an element sets it.
export const fade = defineTokens("fade", {
  stop: { value: "0%", syntax: "<length-percentage>", inherits: false },
  edge: { syntax: "*", inherits: false },
})

// Read by a plain script or a server template the compiler never sees.
export const brand = defineTokens(
  "brand",
  { accent: "oklch(0.7 0.15 150)" },
  { runtime: true }
)

// A value a parent hands down: set as a key, read as a value.
export const ctx = defineTokens("ctx", { iconSize: "1rem" }, { variable: true })

// A theme: overrides for a subtree, a colour as a pair or a token's two halves.
export const ocean = defineTheme(theme, {
  primary: "light-dark(#0369a1, #7dd3fc)",
  imageDim: { light: "none", dark: "brightness(0.7)" },
})

export const styles = {
  page: css({ backgroundColor: theme.background, filter: theme.imageDim }),
  toolbar: css({ [ctx.iconSize]: "0.875rem" }),
  icon: css({ width: ctx.iconSize, height: ctx.iconSize }),
  list: css({
    maskSize: fallback(fade.edge, "2.5rem"),
    gap: space[2],
    borderRadius: radius.base,
  }),
}

// The mode, on <html>: <html sx={mode.system}>, or mode.light / mode.dark from the reader's choice.
export const root = mode.system
```

`space` and `radius` here share their names with `@kirana-style/preset-scales`' groups: they compile
apart, and `check` reports the pair as `token-namespace-shared` (an info). Build on the preset's
scales or name your groups apart.

## Themes and modes

| Handle                           | Sets                                       | Where                                                             |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `mode.system`                    | `color-scheme: light dark`, follows the OS | `<html>`, never `<body>`: the root owns the canvas and scrollbars |
| `mode.light`, `mode.dark`        | one scheme                                 | `<html>`, from a cookie read on the server                        |
| `defineTheme(tokens, overrides)` | the overridden variable tokens             | any subtree, as `sx`; themes nest                                 |

Token defaults sit in the `kirana.tokens` layer on `:root`, theme overrides in `kirana.themes` as a
class, both below component styles: a component that sets a colour itself wins over a theme.
Overriding an inlined token is `token-not-variable`. A three-way switch is state that picks
`mode[scheme]`; to remember it, store the choice in a cookie, render `<html>` with it on the server,
and tell other tabs on a `BroadcastChannel` (https://kirana.style/docs/tokens/themes-and-modes.md
has the code).

## What the compiler checks

| Diagnostic                  | When                                           |
| --------------------------- | ---------------------------------------------- |
| `unknown-token`             | a token the group does not have                |
| `dynamic-token`             | a token reference computed at runtime          |
| `token-not-variable`        | a theme, or a style key, on an inlined token   |
| `token-namespace-collision` | two groups of one namespace in a package       |
| `token-namespace-shared`    | info: two packages declare a group of one name |
