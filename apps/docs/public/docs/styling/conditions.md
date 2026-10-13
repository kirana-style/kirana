# Conditions
Source: https://kirana.style/docs/styling/conditions

# Conditions

A condition goes **inside** the value it changes, not around the object that
holds it:

```tsx
css({
  color: {
    base: "black",
    ":hover": "blue",
    '[aria-current="page"]': "crimson",
  },
})
```

<!-- ::figure-conditions -->

`base` is the unconditional value. Every other key is a condition. The property is
written once, so the whole story of `color` is in one place — and so is the reason
the compiler can tell you when two of those values could both apply.

## What a key may be

| Key                     | Example                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| A pseudo-class          | `":hover"`, `":focus-visible"`, `":disabled"`, `":nth-child(2)"`               |
| An attribute selector   | `'[data-state="open"]'`, `"[aria-expanded]"`                                   |
| A compound of both      | `'[aria-haspopup]:active'`                                                     |
| An at-rule, as a string | `"@media (min-width: 40rem)"`, `"@supports (height: 100dvh)"`                  |
| A condition value       | `[breakpoint.md]`, `[container("(width >= 20rem)")]`, `[media("print")]`       |
| A relation read         | `[group.within('[data-disabled]')]` — see [relations](/docs/styling/relations) |

Condition values come from `media()`, `container()` and `supports()`, and from
presets:

```tsx
import { css, media, supports } from "@kirana-style/core"
import { breakpoint } from "@kirana-style/preset-scales"

css({
  gap: { base: "0.5rem", [breakpoint.md]: "1rem" },
  height: { base: "100vh", [supports("(height: 100dvh)")]: "100dvh" },
  display: { [media("print")]: "none" },
})
```

## Nesting

Conditions nest, and nesting is how you say "both":

```tsx
css({
  backgroundColor: {
    base: "white",
    ":hover": {
      base: "whitesmoke",
      [breakpoint.md]: "gainsboro", // hovered *and* at least md
    },
  },
})
```

Two conditions beat one, so the nested value wins wherever both hold. This is also
the answer when the compiler reports `ambiguous-precedence`: nest the one that
should win inside the other.

## Pseudo-elements are different

`::before` and `::after` are not conditions — they are other elements. They are
top-level keys, holding a style object of their own:

```tsx
css({
  position: "relative",
  "::after": {
    content: '""',
    position: "absolute",
    insetInline: 0,
    blockSize: "1px",
    backgroundColor: { base: "gainsboro", ":hover": "black" },
  },
})
```

Only pseudo-elements and [`select.*`](/docs/styling/contextual) targets are
top-level keys. Everything else nests inside a value.

## Responsive design

Breakpoints are conditions like any other, which has two consequences worth
knowing:

- **A state beats a breakpoint.** `:hover` wins over `md` at every width, because
  attributes and pseudo-classes rank above at-rules. That is what people
  usually mean, and what the Tailwind components this compiler was built against
  relied on.
- **Ranges read as ranges.** For a value that applies only between two widths,
  write the range: `"@media (min-width: 40rem) and (max-width: 47.999rem)"`.

```tsx
css({
  gridTemplateColumns: {
    base: "1fr",
    [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
    [breakpoint.lg]: "repeat(4, minmax(0, 1fr))",
  },
})
```

## Container queries

Containers work the same way, and need a container to query:

```tsx
css({
  containerType: "inline-size",
  containerName: "card",
})

css({
  flexDirection: {
    base: "column",
    [container("(width >= 24rem)", "card")]: "row",
  },
})
```

## What the compiler checks

- An unrecognised condition is an error (`unknown-condition`) — including the
  common mistake of writing a condition as a top-level key.
- Two values that could both apply, with nothing to separate them, get
  `ambiguous-precedence`. Fix it by nesting, or by declaring that the two
  conditions never hold together — see
  [`conditions.exclusive`](/docs/config/reference).

Next: [precedence](/docs/styling/precedence) — the ladder that decides which
condition wins.
