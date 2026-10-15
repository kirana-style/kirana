---
title: Precedence
description: The ladder that decides which value wins, why specificity is not part of it, and what to do when the compiler says two values are ambiguous.
section: cascade
order: 2
keywords: [precedence, cascade, specificity, ladder, ambiguous, trace, layers]
---

# Precedence

Every rule Kirana writes is a single class, so every rule has the same
specificity. What wins is decided by a stated ladder, compared in order: the
first difference decides.

| Step | Comparison              | Higher wins                                                                                                                                                                                                  |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | **Origin**              | An element's own style beats a style it inherited from a [contextual selector](/docs/styling/contextual).                                                                                                    |
| 2    | **Condition count**     | More conditions win. `md + :hover` beats `:hover` beats `base`.                                                                                                                                              |
| 3    | **Condition class**     | `attribute` > `pseudo-class` > `relation` > `at-rule`.                                                                                                                                                       |
| 4    | **Within a class**      | Pseudo-classes by a fixed table (roughly: structural → `:hover` → `:focus` → `:active` → `:checked` → `:invalid` → `:disabled`). At-rules: `@container` > `@media` > `@supports`; a larger `min-width` wins. |
| 5    | **Declaration breadth** | The narrower declaration wins: `paddingTop` beats `padding`, `borderWidth` beats `border`. At equal breadth, a physical longhand beats a logical one.                                                        |
| 6    | **Tie-break**           | Lexicographic, and never meaningful: reaching this step emits `ambiguous-precedence`.                                                                                                                        |

<!-- ::figure-precedence -->

## The two steps you will feel

**State beats breakpoint** (step 3). A `:hover` or `[data-state="open"]` value
wins over a breakpoint value at every width. That is almost always what an author
means, and it is what the Tailwind components this compiler was built against
relied on.

**Narrow beats broad** (step 5), regardless of who wrote first:

```tsx
// paddingTop wins for the top side, wherever it was written.
<div sx={[css({ paddingTop: "2rem" }), css({ padding: "1rem" })]} />
```

## Ambiguity is reported, not guessed

When two entries for the same property could both match, set different values, and
the ladder cannot separate them, the compiler emits `ambiguous-precedence` rather
than picking one:

```tsx
css({
  color: {
    '[data-state="open"]': "red",
    "[aria-expanded]": "blue", // both can be true at once
  },
})
```

Three ways to resolve it:

1. **Nest the winner** inside the loser. Two conditions beat one, and the
   ambiguity is gone:

   ```tsx
   css({
     color: {
       "[aria-expanded]": {
         base: "blue",
         '[data-state="open"]': "red",
       },
     },
   })
   ```

2. **Say they are exclusive.** When a library guarantees two attributes never
   appear together (`[data-open]` and `[data-closed]`), declare it once in
   [`conditions.exclusive`](/docs/config/reference).

3. **Use the same value**, if that is the truth. Two entries with the same value
   are never ambiguous.

The compiler already knows some pairs are exclusive on their own: two values of
one attribute, a selector and its negation, or two fixed positions counted from
the same end.

## Layers

Everything Kirana emits is inside layers, in this order:

```css
@layer reset, base, kirana; /* your layers, from configuration */
@layer kirana.tokens, kirana.themes, kirana.contextual, kirana.atoms;
```

Your own global CSS (a reset, base element styles) goes in layers you name in
[configuration](/docs/config/layers), which sit below every Kirana rule. Nothing
Kirana writes is unlayered, custom-property assignments included.

## Asking why

When a value does not win and you want the reason, ask:

```bash
kirana trace src/components/card.tsx:24 padding-top
```

It prints one line per candidate declaration (value, conditions, layer), marks
the winner, and names the step that decided it, for example
`step 5 (set 1 longhand < 4)`.
