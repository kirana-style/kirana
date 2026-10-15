---
title: Your first component
description: Build a button with a hover state and a quiet variant, and read the CSS the compiler produced from it.
section: start
order: 5
keywords: [tutorial, first component, button, example]
---

# Your first component

A button, with a hover state and a second variant. Everything below is one file,
and the tabs show what the compiler made of it: the CSS and the class names on
this page came out of the compiler, not out of prose.

<!-- ::example name="button-variants" -->

## What to notice

**The condition lives inside the value.** `backgroundColor` is written once, with
its resting value and its hover value together:

```tsx
backgroundColor: {
  base: "light-dark(oklch(0.21 0 0), oklch(0.92 0 0))",
  ":hover": "light-dark(oklch(0.31 0 0), oklch(0.85 0 0))",
}
```

You never look in two places to find out what colour a button is.

**Colours are `light-dark()` pairs.** There is no dark variant, no `dark:` prefix
and no second stylesheet. The browser picks the half that matches the page's
`color-scheme`, which the app sets once on `<html>`.

**The second variant is a second handle.** `sx={[styles.base, styles.quiet]}`
merges them in order, and the merge happens **per entry**: the quiet style's base
colour replaces the first one's base colour, and its hover colour replaces the
hover colour. Everything it does not mention (the padding, the radius, the font)
is still there. [Merging](/docs/styling/merging) has the rule, and how to drop an
entry you did not name.

**One class per declaration.** Open the Classes tab: thirteen classes, each a
single declaration. [How it works](/docs/start/how-it-works#the-pipeline) explains
why that keeps the stylesheet small.

## Next

- [How it works](/docs/start/how-it-works): what happens between the file and
  the stylesheet.
- [Mental model](/docs/start/mental-model): the five ideas the rest builds on.
