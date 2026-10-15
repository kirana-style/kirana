---
title: Merging replaces entries, not properties
summary: The rule behind most of the surprises people meet in their first week, and the property test that found a real bug in it.
date: 2026-09-18
author: Kirana team
tags: [cascade, compiler]
cover: https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1600&q=80&auto=format&fit=crop
coverAlt: Layers of white curved lines
---

Here is a style, and an override:

```tsx
const link = css({ color: { base: "navy", ":hover": "royalblue" } })
const quiet = css({ color: "grey" })

<a sx={[link, quiet]} />
```

The anchor is grey. On hover it is royal blue.

If that reads as a bug, you have been writing class strings: `text-grey` after
`hover:text-blue` removes the whole colour idea. If it reads as obvious, you have
been writing CSS, where two rules for one property coexist and the cascade picks
between them per state.

Kirana takes the CSS reading. A property holds **entries**, one per condition set,
and merging replaces the entries it names.

## Why that is the right default

Because the alternative loses information that nobody wrote down. `quiet` said
something about the resting colour; it said nothing about hover. Deleting the
hover value would be inventing an intent.

When you _do_ mean "and nothing else", you say so:

```tsx
const quiet = css({ color: { "*": null, base: "grey" } })
```

## Where it gets interesting: shorthands

Merging is defined on longhands, so this works the way you want across modules:

```tsx
css({ padding: "1rem" }, { paddingTop: "2rem" }) // 2rem top, 1rem elsewhere
```

But a shorthand is not always splittable. `border: var(--line)` is one custom
property standing in for width, style and colour at once. The compiler cannot
know which part is which, so it keeps the declaration whole as a _shorthand atom_
and warns you that a later style cannot remove one of its longhands precisely.

Now the interesting part: a shorthand atom and the longhands it covers have to
merge correctly even when the two are written in different modules, in either
order, under different conditions.

## The bug

That logic is covered by a property test: generate a random sequence of writes
and removals across a family of related properties, apply them, and assert that
every longhand ends up with the value the author's intent gives it.

It found this:

```tsx
border: "var(--v)" // a shorthand atom covering 12 longhands
borderWidth: 0 // a family atom covering 4 of them
borderColor: null // removes the colours
borderTop: null // removes the top side
```

After the last line, the right, bottom and left widths came out as `var(--v)`
instead of `0`.

The cause was ordering. When `borderColor: null` unfolded the broad `border` atom
into its remaining longhands, those longhands were appended at the _end_ of the
merge order, after the narrower `borderWidth` atom that had been written later.
So the next removal looked at them and concluded they were newer than they were.

The fix: unfolded longhands take the place of the atom they came from, so merge
order keeps matching the order the values were actually written. The same change
had to land in the compiler and in the 1 kB runtime, because the two must agree
exactly, and a shared table of vectors checks that they do.

## The moral

Merge semantics are the part of a styling system that everyone assumes is simple.
It is not simple, it is the thing that decides whether your overrides do what you
meant, and it deserves a property test rather than a handful of examples.

[Merging and removal](/docs/styling/merging) has the rules, and
[precedence](/docs/styling/precedence) has the ladder that applies afterwards.
