---
title: Tokens
description: Declare tokens with defineTokens, choose between inlined values and custom properties, and keep each token a typed constant.
section: tokens
order: 1
keywords: [tokens, defineTokens, design tokens, custom properties, variables]
---

# Tokens

A token is a named value your styles refer to. In Kirana it is an ordinary
imported constant, so your editor shows the value, "go to definition" works, and
nothing needs code generation.

```tsx
import { defineTokens } from "@kirana-style/core"

export const space = defineTokens("space", {
  1: "0.25rem",
  2: "0.5rem",
  4: "1rem",
})

css({ gap: space[2] })
```

The first argument is the **namespace**. It has to be unique in a package: two
groups claiming one namespace is an error (`token-namespace-collision`).

A token's identity carries its package, so packages may each have a `theme` group
and compile to different variables, which keeps libraries from overwriting each
other's. Because they then read alike, the compiler points such a pair out with an
info (`token-namespace-shared`), and `kirana-style export` names each token's
package.

## Inlined or a custom property

By default a token is **inlined**: `gap: space[2]` compiles to `gap: 0.5rem`. The
token costs nothing, and unreferenced tokens emit nothing at all.

Ask for a custom property when the value must be _overridable at runtime_, for a
theme, a mode, or a value a parent hands down:

```tsx
export const theme = defineTokens(
  "theme",
  { surface: "white", text: "black" },
  { variable: true }
)
```

Now `theme.surface` compiles to `var(--k…)`, the defaults are declared once in the
`kirana.tokens` layer, and anything below can override them.

|                        | Inlined                      | `variable: true`                  |
| ---------------------- | ---------------------------- | --------------------------------- |
| Compiles to            | the literal value            | `var(--k…)`                       |
| Overridable at runtime | no                           | yes                               |
| Cost                   | none                         | one declaration per token used    |
| Use for                | scales: spacing, radii, type | themes, modes, values handed down |

## Per-mode values

A token can carry a light and a dark value:

```tsx
export const theme = defineTokens(
  "theme",
  { surface: { light: "white", dark: "oklch(0.21 0 0)" } },
  { variable: true }
)
```

Colours are usually better written as one `light-dark()` value, which needs no
variable at all and no mode plumbing. Use `{ light, dark }` for values
`light-dark()` cannot express, such as a shadow's opacity, a blend mode or an
image filter. [Themes and modes](/docs/tokens/themes-and-modes) covers the difference.

## Registered tokens

Give a token a syntax and it becomes a real registered property, which means the
browser can animate it:

```tsx
export const fade = defineTokens("fade", {
  stop: { value: "0%", syntax: "<length-percentage>", inherits: false },
})
```

This emits `@property`, and the token may then be used as a keyframe key.

With the universal syntax a token may have no value at all. It starts unset, and
every reference to it falls back to nothing (`var(--k…,)`), so a chain of such
tokens lists only the parts an element sets. That is how Tailwind composes
`filter`:

```tsx
export const step = defineTokens("step", {
  blur: { syntax: "*", inherits: false },
  grey: { syntax: "*", inherits: false },
})

css({
  [step.grey]: "grayscale(100%)",
  filter: `${step.blur} ${step.grey}`, // grayscale(100%)
})
```

## Tokens nothing uses

A production build writes a variable token's declaration only when something uses
it. That means a rule that reads it, or the finished JavaScript still naming it, as
`el.style.gap = space.lg` does. A design system can define a hundred variable
tokens, and a page that reads ten ships ten.

A token read by code the compiler never sees needs saying so. Examples: a plain
script, a server-only template, a third party. Declare it `runtime: true`, for one
token or the whole group, and it is always written:

```tsx
export const brand = defineTokens(
  "brand",
  { accent: "oklch(0.7 0.15 150)" },
  { runtime: true }
)
```

`runtime: true` implies `variable: true`. If code rendered after the stylesheet
names a token it left out, as a server-only component can, the build stops and
names the token, so a missing declaration never reaches a page.

The dev server, `kirana-style check` and bundlers other than Vite and Rolldown
write every variable token, as before.

## A token as a style key

A variable token can be the _key_ of a declaration, which sets that custom
property for the subtree:

```tsx
css({ [ctx.iconSize]: "0.875rem" })
```

That is how a control tells the icons inside it how big to be, without either side
knowing the other's class names.

## What the compiler checks

- A token that does not exist: `unknown-token`.
- A token reference computed at runtime: `dynamic-token`, since tokens are
  build-time values by design.
- `defineTheme` on a token that is not a custom property: `token-not-variable`.

## Next

- [Using the scales preset](/docs/tokens/preset-scales): Tailwind's vocabulary,
  ready to import.
- [Semantic tokens](/docs/tokens/semantic-tokens): building your own layer on
  top.
