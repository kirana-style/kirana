# Your first component
Source: https://kirana.style/docs/start/first-component

# Your first component

A button, with a hover state and a second variant. Everything below is one file,
and the tabs show what the compiler made of it — the CSS and the class names on
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
merges them in order, and the merge happens **per entry**: `quiet`'s base colour
replaces `base`'s base colour, and `quiet`'s hover colour replaces `base`'s hover
colour. Everything it does not mention — the padding, the radius, the font — is
still there.

> [!IMPORTANT] This is the rule that surprises people
> A later style replaces the _entries_ it names, not the whole property. Writing
> `backgroundColor: "red"` after a style that sets `:hover` leaves that hover
> value in place. [Merging](/docs/styling/merging) explains how to remove it when
> that is what you want.

**One class per declaration.** Open the Classes tab: thirteen classes, each a
single declaration. Two components that both write `display: flex` share a class,
so the stylesheet grows with the number of distinct declarations, not with the
number of components.

## Next

- [How it works](/docs/start/how-it-works) — what happens between the file and
  the stylesheet.
- [Mental model](/docs/start/mental-model) — the four ideas the rest builds on.
