---
title: Mental model
description: Five ideas make Kirana predictable: properties instead of classes, entries instead of properties, a ladder instead of specificity, styling only what you render, and an editor that shows what each element gets.
section: start
order: 6
keywords:
  [
    mental model,
    concepts,
    merging,
    precedence,
    specificity,
    editor,
    inlay hints,
  ]
---

# Mental model

Five ideas. Everything else in these docs is a consequence of one of them.

<!-- ::figure-mental-model -->

## 1 · You write properties, not classes

A style is an object of CSS properties with real values. There is no vocabulary
to memorise, no scale to look up before you can write a length, and no class-name
grammar to decode when you read it back.

```tsx
const card = css({
  borderRadius: "0.75rem",
  padding: "1.5rem",
  boxShadow: "0 1px 2px oklch(0 0 0 / 0.08)",
})
```

Design tokens are ordinary imported values, so a token is just a constant your
editor can show you; see [tokens](/docs/tokens/overview).

## 2 · Merging replaces entries, not properties

This is the one that catches people, and it is worth ten minutes now rather than
an afternoon later.

A property can hold several **entries**: one per condition. When you merge two
styles, the later one replaces **the entries it names** and leaves the rest alone.

```tsx
const base = css({
  color: { base: "black", ":hover": "blue" },
})

// Replaces the base entry. The `:hover` entry is still there.
const override = css({ color: "grey" })

<a sx={[base, override]} /> // grey, and blue on hover
```

[Merging](/docs/styling/merging) shows how to remove the entries you did not name.

## 3 · A ladder decides what wins, not specificity

Every rule Kirana writes is one class, so every rule has the same specificity. A
stated ladder decides instead, and two of its steps cover most days:

- **More conditions win.** A `:hover` value beats a base value.
- **Then the narrower declaration.** `paddingTop` beats `padding`, in either order.

When the ladder cannot separate two values, the compiler reports
`ambiguous-precedence` instead of picking. [Precedence](/docs/styling/precedence)
is the whole ladder.

## 4 · Style what you render

The compiler styles elements it can see in your source. An element rendered inside
a component from an installed package is not yours, so `sx` on that component does
nothing unless the component reads it, and the compiler will tell you so
(`sx-on-external-component`).

Three ways out, in order of preference:

1. Pass compiled props, `{...props(styles.thing)}`, which works with any component
   that spreads props onto an element.
2. Style it from an ancestor you do render, with
   [`select`](/docs/styling/contextual).
3. Read its state from a parent with a [relation](/docs/styling/relations).

## 5 · Your editor shows what the element gets

A class list puts the CSS on the element; a style object puts it behind a name. So
the language server writes it back where you read: every element's line ends with
what it gets, in a class list's words.

<!-- prettier-ignore -->
```tsx editor file="src/plan.tsx"
export function Plan({ featured }: { featured: boolean }) {
  return (
    <article sx={[card, featured && raised]}> //: ▦ grid · gap 1rem · p 1rem · featured: shadow lg
      <h2 sx={title}>Pro</h2> //: text 1.25rem · 600 · ink
    </article>
  )
}
```

Read it the way you read `grid gap-4 p-4`. Hover it for the box model, every
declaration with `rem` in pixels and the token it reads, and the compiled rule;
hover one property to see which entry wins and why. The answers come from the same
compiler session as the build, so the editor never disagrees with the stylesheet:
if it shows `p 1rem`, the element gets `padding: 1rem`. See
[editor support](/docs/tooling/editor).

## Coming from somewhere else

- **From Tailwind:** the vocabulary is the same (`@kirana-style/preset-scales` carries
  Tailwind's scales), but conditions nest inside values instead of prefixing class
  names, and the merge story is different from `cn()`. The class list you read is
  still there, at the end of the line in your editor (idea 5).
  [Migration guide](/docs/migration/from-tailwind).
- **From StyleX:** the API will look familiar. The difference that bites is idea
  2: StyleX's `default: null` means "no base value", Kirana's `base: null`
  _removes_ an earlier one. [Migration guide](/docs/migration/from-stylex).
