---
title: Recipes
description: recipe() for variants, compound variants and slots - resolved at build time when the options are known.
section: styling
parent: composition
order: 9
keywords: [recipe, variants, cva, slots, compound variants, defaults]
---

# Recipes

A recipe is a component's variants in one place: a base style, named groups of
options, and the combinations that need a value of their own.

```tsx
import { recipe } from "@kirana-style/core"

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "0.5rem",
    fontWeight: 500,
  },
  variants: {
    tone: {
      solid: { backgroundColor: "black", color: "white" },
      quiet: { backgroundColor: "transparent", color: "black" },
    },
    size: {
      sm: { paddingInline: "0.5rem", fontSize: "0.75rem" },
      md: { paddingInline: "0.875rem", fontSize: "0.875rem" },
    },
  },
  compoundVariants: [
    { tone: "quiet", size: "sm", css: { paddingInline: "0.375rem" } },
  ],
  defaultVariants: { tone: "solid", size: "md" },
})

<button sx={button({ tone: "quiet" })} />
```

## Static calls compile to a constant

When the options are known at build time, the call disappears: the element gets a
class string, and no recipe table ships. When an option is a runtime value, the
recipe resolves through the small private runtime instead, and the compiler tells
you it did (`dynamic-variant`, informational).

```tsx
button({ tone: "quiet" }) // compiles to a constant
button({ tone: props.tone }) // resolved at runtime, reported as dynamic-variant
```

Both work. The diagnostic exists so you can see which components carry a runtime
cost.

## Slots

A component with several parts gives them one recipe. Each variant lists the
slots it changes, and calling the recipe returns a handle per slot:

```tsx
export const field = recipe({
  slots: ["root", "label", "input"],
  base: {
    root: { display: "grid", gap: "0.25rem" },
    label: { fontSize: "0.875rem" },
    input: { borderRadius: "0.375rem" },
  },
  variants: {
    invalid: {
      true: {
        label: { color: "crimson" },
        input: { borderColor: "crimson" },
      },
    },
  },
})

const parts = field({ invalid })
<div sx={parts.root}>
  <label sx={parts.label} />
  <input sx={parts.input} />
</div>
```

Boolean variants are written as the string keys `"true"` and `"false"`, and
called with real booleans.

## Checks

- An option that names a group or value the recipe does not define is an error
  (`unknown-variant`).
- A style that names a slot the recipe does not declare is an error
  (`unknown-slot`).

Both catch the rename that used to leave a component silently unstyled.

## Recipes or plain handles?

Use a recipe when a component has variants a caller chooses by name. Use plain
handles when it does not — an object of `css()` handles is simpler to read, and
merging already gives you composition:

```tsx
const styles = {
  root: css({ … }),
  open: css({ … }),
}
<div sx={[styles.root, isOpen && styles.open]} />
```
