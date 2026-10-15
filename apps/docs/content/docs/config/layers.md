---
title: Layers and global CSS
description: Where a reset goes, why Kirana emits nothing unlayered, and how to keep third-party CSS below your styles.
section: config
order: 2
keywords: [layers, cascade layers, reset, global css, preflight]
---

# Layers and global CSS

Kirana writes every rule inside a layer, and declares the order in one statement
at the top of the stylesheet:

```css
@layer reset, base, kirana;
@layer kirana.tokens, kirana.themes, kirana.contextual, kirana.atoms;
```

<!-- ::figure-layers -->

The first line is yours: the names from `layers.before` and `layers.after`. The
second is Kirana's own, and its order is fixed.

| Layer               | Holds                                                            |
| ------------------- | ---------------------------------------------------------------- |
| `kirana.tokens`     | Variable token defaults on `:root`, and their per-mode overrides |
| `kirana.themes`     | `defineTheme` overrides                                          |
| `kirana.contextual` | `select.*` styles                                                |
| `kirana.atoms`      | Element styles: everything you write with `css()`                |

Nothing Kirana emits is unlayered, custom-property assignments included. That is
what lets a reset stay a reset: it cannot accidentally outrank a component style,
and a component style cannot accidentally outrank a theme.

## Your own layers

```ts file="kirana.config.ts"
export default defineConfig({
  layers: { before: ["reset", "base"] },
})
```

Then write your global CSS into those layers:

```css file="globals.css"
@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  body {
    margin: 0;
  }
}

@layer base {
  a {
    color: inherit;
  }
}
```

Because `reset` and `base` come before `kirana` in the order statement, every
Kirana rule wins over them, whatever their selectors look like.

## Load order matters once

Import Kirana's stylesheet **before** your global CSS. Its `@layer` statement is
what fixes the order, and a layer first seen inside `globals.css` would otherwise
be ordered by where it appeared.

```tsx
<link rel="stylesheet" href={kiranaCss} />   {/* first */}
<link rel="stylesheet" href={globalCss} />
```

## Third-party CSS

A package's stylesheet you cannot edit (a date picker, a carousel) goes into a
layer you name, so your styles beat it without `!important`:

```ts
layers: {
  before: ["reset", "vendor", "base"]
}
```

```css
@import "some-package/dist/style.css" layer(vendor);
```

## When to write global CSS at all

Rarely. Two cases hold up:

- **A reset**, and base element styles that must apply to bare tags.
- **Markup you do not render**, where no component can carry a class, scoped by
  an attribute the library sets, as narrowly as you can manage.

Everything else belongs in `css()`, where the compiler can see it, check it and
tell you when two declarations fight.
