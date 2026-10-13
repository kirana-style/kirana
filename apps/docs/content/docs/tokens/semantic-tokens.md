---
title: Semantic tokens
description: Naming your decisions - a variable layer with light-dark() pairs, so dark mode needs no variant.
section: tokens
order: 3
keywords:
  [semantic tokens, design system, light-dark, dark mode, surface, primary]
---

# Semantic tokens

Scales tell you what values exist. Semantic tokens say what they _mean_: what a
card's surface is, what "primary" is, what a border looks like. This is the layer
that makes a component readable — `backgroundColor: theme.card` says something
`color.zinc50` does not.

```tsx
import { defineTokens } from "@kirana-style/core"
import { color } from "@kirana-style/preset-scales"

export const theme = defineTokens(
  "theme",
  {
    background: `light-dark(${color.white}, ${color.zinc950})`,
    foreground: `light-dark(${color.zinc950}, ${color.zinc50})`,
    card: `light-dark(${color.white}, ${color.zinc900})`,
    border: `light-dark(${color.zinc200}, ${color.zinc800})`,
    primary: `light-dark(${color.amber500}, ${color.amber400})`,
  },
  { variable: true }
)
```

Two decisions in that snippet, and both matter.

## Every colour is one `light-dark()` pair

`light-dark()` resolves against the element's `color-scheme`, so one declaration
covers both schemes. There is no dark variant, no `.dark` class, no duplicated
block, and no way for the two halves to drift apart — they are written on the same
line.

```tsx
// the whole story of this colour, in one place
card: `light-dark(${color.white}, ${color.zinc900})`
```

The application sets `color-scheme` once, at the root
([themes and modes](/docs/tokens/themes-and-modes)).

## Semantic tokens are variables

`variable: true`, because these are the values a theme overrides. Scales stay
inlined: nobody re-themes `space[4]`.

## Intent tokens for the things `light-dark()` cannot hold

Sometimes the two schemes differ in something that is not a colour: a shadow's
strength, an image filter, a blend mode. Those get per-mode values:

```tsx
export const surface = defineTokens(
  "surface",
  {
    imageDim: { light: "none", dark: "brightness(0.8)" },
  },
  { variable: true }
)
```

The same idea covers pairs where light and dark want _different roles_ rather than
different shades — a control that is a tint in light and a solid in dark. Naming
that intent once (`surface.control`) beats repeating a conditional in every
component that needs it.

## Deriving values

Tokens are constants, so deriving one from another is just an expression:

```tsx
export const radius = defineTokens(
  "radius",
  {
    base: "0.625rem",
    sm: "calc(0.625rem * 0.6)",
    lg: "0.625rem",
    xl: "calc(0.625rem * 1.4)",
  },
  { variable: true }
)

export const alpha = defineTokens("alpha", {
  primary20: `color-mix(in oklab, ${theme.primary} 20%, transparent)`,
})
```

`color-mix` with a variable token keeps the relationship live: re-theme
`theme.primary` and every tint follows.

## Where to put it

One module, exported, imported by every component. In this repository it is
`packages/ui/src/theme/semantic.ts`, and adding a colour is one line there rather
than a decision in each component.
