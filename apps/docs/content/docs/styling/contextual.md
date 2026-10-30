---
title: Contextual styles
description: Style the elements below you with select.descendant and select.child, in a layer their own styles still beat.
section: composition
order: 3
keywords: [select, descendant, child, contextual, svg, layer]
---

# Contextual styles

`select` styles elements _below_ an element you render, by name or attribute:

```tsx
import { css, select } from "@kirana-style/core"

const button = css({
  display: "inline-flex",
  gap: "0.5rem",
  // Every svg inside this button, unless the svg says otherwise.
  [select.descendant("svg")]: {
    width: "1rem",
    height: "1rem",
    flexShrink: 0,
  },
})
```

`select.descendant(target)` reaches any depth; `select.child(target)` only direct
children. Both are top-level keys holding a style object, like a pseudo-element.

## They lose to the element's own styles

Contextual rules are written to a layer below element styles, so anything the
target sets for itself wins, whatever conditions it carries.

That is the point. In a class-based system a parent's `[&_svg]:size-4` competes
with the icon's own size class and usually wins, which is why such rules grow
guards like `:not([class*='size-'])`. Here the guard is unnecessary: give the icon
a size and it keeps it.

```tsx
<button sx={button}>
  {/* 1.25rem wins */}
  <Icon sx={css({ width: "1.25rem", height: "1.25rem" })} />
</button>
```

## What a target may be

One compound selector: an element name, attribute selectors and pseudo-classes,
alone or together:

```tsx
select.descendant("svg")
select.child("li")
select.descendant('[data-slot="indicator"]')
select.child("span:last-child") // the last span child
select.descendant("a:hover") // a link while it is hovered
```

No combinators (`a > b`) and no pseudo-elements: a target is the element itself.

## A state under a target is the parent's

A condition nested inside a target's style object reads the element that carries
the style, as it does under a pseudo-element. The target's own state goes into the
target:

```tsx
const nav = css({
  // Links turn red while the nav is hovered.
  [select.child("a")]: { color: { ":hover": "red" } },
  // A link turns red while it is hovered itself.
  [select.child("a:hover")]: { color: "red" },
})
```

Tailwind's `*:hover:text-red-500` means the second. The first compiles, and the
compiler adds an info (`select-state-on-parent`) suggesting the target form. When
the parent's state is what you mean, read it through a
[relation](/docs/styling/relations) and the info goes away.

Class selectors are not targets: Kirana's class names are hashes, and a
handwritten class is markup the compiler cannot verify. An unsupported target is
an error (`unsupported-contextual-target`).

## When to reach for it

- Styling an icon, a bullet, or any element a library renders inside yours.
- Giving a wrapper's children a shared rhythm you do not want to repeat on each
  one.

When you own the element, style it directly instead: it is easier to read, and it
lands in the higher layer where it belongs.

## Alternatives

| Situation                                                 | Use                                            |
| --------------------------------------------------------- | ---------------------------------------------- |
| The element is rendered by a component that spreads props | [`props()`](/docs/styling/external-components) |
| The element's style depends on an ancestor's _state_      | [relations](/docs/styling/relations)           |
| The element is below you and you just need a default      | `select`                                       |
