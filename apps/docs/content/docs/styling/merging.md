---
title: Merging and removal
description: How styles combine per entry, and how to remove a value with null.
section: cascade
order: 1
keywords: [merge, cx, override, null, remove, entries]
---

# Merging and removal

Styles combine in three places: `css(a, b)`, `cx(a, b)`, and `sx={[a, b]}`. All
three merge the same way, in order, and the rule is the one from the
[mental model](/docs/start/mental-model):

> A later style replaces the entries it names, and leaves the others alone.

## Entries, not properties

A property holds one entry per condition set. `color` with a base value and a
`:hover` value is two entries.

```tsx
const link = css({
  color: { base: "navy", ":hover": "royalblue" },
  textDecorationLine: "underline",
})

const quiet = css({ color: "grey" })

<a sx={[link, quiet]} />
```

The anchor is grey, still royal blue on hover, and still underlined. `quiet` named
the base entry of `color`, so that is the entry it replaced.

<!-- ::figure-merge -->

This is the single biggest difference from class-string systems, where a later
`text-grey` removes the whole colour idea, hover included.

## Removing

`null` removes. There are three forms, and they differ in reach:

```tsx
// one entry
css({ color: { base: null } })

// every entry of one property
css({ color: null })

// everything except what this style lists
css({ color: { "*": null, base: "grey" } })
```

`{ "*": null, base: "grey" }` is the one to reach for when you want a component's
conditional chrome gone and your own value in its place, such as an input inside a
group that should lose the group's focus ring.

> [!WARNING] `base: null` is not "no value"
> In StyleX, `default: null` means "this variant sets nothing here". In Kirana,
> `base: null` **removes** a base value an earlier style set. If you are porting,
> this is the line to re-read; see
> [migrating from StyleX](/docs/migration/from-stylex).

## `cx()`

`cx()` merges handles and skips `null`, `undefined` and `false`, which makes
conditional composition read naturally:

```tsx
import { cx } from "@kirana-style/core"

const handle = cx(styles.root, isOpen && styles.open, props.sx)
```

`sx={[a, b]}` accepts the same shapes, including nested arrays, so you rarely need
`cx()` on an element: it is for building a handle to pass on.

## Order is the order you wrote

Merging is left to right, and the last writer of an entry wins **that entry**.
What order does _not_ decide is a conflict between two different conditions: that
is the [precedence ladder](/docs/styling/precedence), and it applies after
merging.

```tsx
// Both entries survive the merge; the ladder decides which applies when hovered.
css({ color: "black" }, { color: { ":hover": "blue" } })
```

## Class strings come from a merge

A merge leaves an element one class per entry, and the stylesheet relies on it:
two classes for the same entry never reach one element, so the compiler orders
them however writes the smallest stylesheet. Joining two compiled class strings
by hand skips the merge, and when both name the same entry, which one applies is
not defined.

```tsx
// Both strings may set the base `color`: either can win.
<a className={`${props(link).className} ${props(quiet).className}`} />

// The merge keeps one: `quiet`'s.
<a sx={[link, quiet]} />
```

Pass handles instead, and combine them with `sx`, `cx()` or `props()`.

## Shorthands merge per longhand

```tsx
css({ padding: "1rem" }, { paddingTop: "2rem" })
```

`padding` expands to four longhands, `paddingTop` replaces one of them, and the
other three keep `1rem`. The same is true across modules and across components:
merging is defined on longhands, so nothing depends on which shorthand each author
happened to use.

Removing a whole box removes it on both axes, since in any writing mode the four
physical sides are the four logical ones:

- `padding: { "*": null }` also removes a component's `paddingInline`;
- `paddingBlock` and `paddingInline` both `"*": null` in one style also remove a
  component's `padding`, under every condition it set it;
- one side or one axis alone (`paddingLeft`, `paddingBlock`) removes only what it
  names, since which side it is depends on the text's direction.

```tsx
const empty = css({ padding: { base: "8px", "@media (width >= 48rem)": "24px" } })
const tight = css({
  paddingBlock: { "*": null, base: "4px" },
  paddingInline: { "*": null, base: "4px" },
})

// 4px at every width: `empty`'s `padding` is removed with both axes.
<div sx={[empty, tight]} />
```

## A component's own `sx`

A component that takes `sx` should merge it **last**, so its caller can override:

```tsx
export function Card({
  sx,
  ...props
}: { sx?: Sx } & React.ComponentProps<"div">) {
  return <div {...props} sx={[styles.root, sx]} />
}
```

Declaring `sx` and never applying it is reported (`unused-sx`).
