---
title: Debugging styles
description: Why doesn't my style apply? A short list, in the order worth checking.
section: tooling
order: 5
keywords: [debugging, troubleshooting, trace, not applying, devtools]
---

# Debugging styles

A style is not doing what you expect. In rough order of likelihood:

## 1 · Is the module compiled?

If `css()` runs in a module the compiler never saw, it throws with a message that
says exactly that. If you see the error, the fix is the adapter: `kirana()` must
be in the bundler's plugin list, and before the framework plugin.

## 2 · Is the element yours?

`sx` on a component from a package does nothing. The compiler warns
(`sx-on-external-component`), so check the terminal — and see
[styling other people's components](/docs/styling/external-components).

## 3 · Did a merge keep an entry you meant to replace?

The most common surprise. A later style replaces the entries it names:

```tsx
// still blue on hover
<a
  sx={[
    css({ color: { base: "black", ":hover": "blue" } }),
    css({ color: "grey" }),
  ]}
/>
```

Use `{ "*": null, base: "grey" }` when you mean "and nothing else".
[Merging](/docs/styling/merging).

## 4 · Ask the compiler

```bash
kirana trace src/components/card.tsx:24 padding-top
```

It lists every candidate declaration for that property, marks the winner, and
names the ladder step that decided. If your value is not in the list at all, the
problem is upstream — the style is not on that element.

<!-- ::figure-trace -->

## 5 · Check the conditions

- A condition as a **top-level key** is an error, and the message says so.
- A state beats a breakpoint — that is the ladder, not a bug.
- A relation read needs its anchor on the element whose state you are reading.

## 6 · Look at the CSS

The stylesheet is plain CSS with one declaration per rule, so devtools tell you
the truth quickly: inspect the element, read the class list, and look for the
declaration. A class that is present but crossed out is a precedence question
(step 4, ask `trace`). A declaration that is missing entirely is a compile
question (check the terminal).

## 7 · Animations that do nothing

Transition the property you actually set: `translate`, `scale` and `rotate` are
not `transform`. See [animation](/docs/styling/animation).
