---
title: Themes and modes
description: Set the colour mode on the root element with mode.system, mode.light or mode.dark, and override tokens for a subtree with defineTheme.
section: tokens
order: 4
keywords: [theme, dark mode, color-scheme, defineTheme, mode, system]
---

# Themes and modes

## Modes

`mode` gives you three handles that set `color-scheme`:

```tsx
import { mode } from "@kirana-style/core"

<html sx={mode.system} />   // color-scheme: light dark - follows the OS
<html sx={mode.light} />
<html sx={mode.dark} />
```

Put it on the **root element**, not the body: the root decides the page's canvas
and scrollbars, and an iframe whose root scheme differs from its frame gets an
opaque backdrop.

With every colour written as a [`light-dark()` pair](/docs/tokens/semantic-tokens),
that single declaration is the whole dark-mode implementation. `system` needs no
JavaScript at all.

A three-way switch is then ordinary state:

```tsx
const [scheme, setScheme] = useState<"system" | "light" | "dark">("system")

<html sx={mode[scheme]}>
```

## Themes

`defineTheme` overrides variable tokens for a subtree:

```tsx
import { defineTheme } from "@kirana-style/core"
import { theme } from "./tokens"

export const brand = defineTheme(theme, {
  primary: `light-dark(${color.violet500}, ${color.violet400})`,
})

<section sx={brand}>…</section>
```

Everything inside the section reads the new value; everything outside is
untouched. Themes nest, and a theme may override some tokens and leave the rest.

<!-- ::figure-themes -->

Only **variable** tokens can be overridden: overriding an inlined one is an error
(`token-not-variable`), because there is no variable to change. If a token needs a
theme, declare its group with `variable: true`.

### Per-mode overrides

A theme can set both halves of a token:

```tsx
export const brand = defineTheme(theme, {
  surface: { light: "white", dark: "oklch(0.24 0 0)" },
})
```

## Where the values live

- Token defaults go in the `kirana.tokens` layer, on `:root`.
- Theme overrides go in `kirana.themes`, as a class.

Both sit below your component styles, so a component that sets a colour directly
always wins over a theme that suggests one.

## Switching without a flash

The mode handle is a class on the root element, so server-rendered HTML can carry
it: render the user's stored preference into the root on the server, and there is
no flash. `system` needs nothing stored at all.

## What not to do

- **Do not put the mode on `<body>`.** The canvas belongs to the root.
- **Do not write a `dark:` variant.** There is no dark variant; the pair is in the
  token.
- **Do not theme scales.** Re-theming `space[4]` makes a layout unpredictable;
  theme the semantic layer instead.
