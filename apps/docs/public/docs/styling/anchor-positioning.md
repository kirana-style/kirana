# Anchor positioning
Source: https://kirana.style/docs/styling/anchor-positioning

# Anchor positioning

CSS anchor positioning places an element against another one, and
`position-try-fallbacks` lists where to put it when the first place overflows.
The built-in fallbacks (`flip-block`, `flip-inline`) mirror the position;
`positionTry()` defines your own.

```tsx
import { css, positionTry } from "@kirana-style/core"

const below = positionTry({
  positionArea: "bottom span-right",
  marginTop: "4px",
  width: "anchor-size(width)",
})
const above = positionTry({ positionArea: "top", marginBottom: "4px" })

export const tooltip = css({
  position: "absolute",
  positionAnchor: "--trigger",
  positionArea: "top",
  positionTryFallbacks: `${below}, ${above}, flip-inline`,
})
```

`positionTry()` returns a dashed ident, `--kp…`, and emits an `@position-try`
rule with that name:

```css
@layer kirana.tokens {
  @position-try --kp9KfV {
    position-area: bottom span-right;
    margin-top: 4px;
    width: anchor-size(width);
  }
}
```

The name is hashed from the declarations, like a keyframes name, so the same
block defined in two modules is one rule. The rule ships only when something
refers to it: a `positionTryFallbacks` value, a template string, or an export
another module reads.

## What a fallback may set

An `@position-try` block accepts the properties that place and size the box:

| Group          | Properties                              |
| -------------- | --------------------------------------- |
| Inset          | `top`, `insetInline`, …                 |
| Margin         | the margin properties                   |
| Sizing         | `width`, `maxInlineSize`, …             |
| Self-alignment | `alignSelf`, `justifySelf`, `placeSelf` |
| Anchoring      | `positionAnchor`, `positionArea`        |

A browser ignores anything else without a word, so Kirana reports it instead:

```tsx
positionTry({ color: "red" })
// invalid-position-try: color has no effect in @position-try
```

Values are plain: a fallback has no hover state or breakpoint of its own, so a
conditional value is `invalid-position-try` too. Tokens and
[`firstThatWorks()`](/docs/styling/fallbacks) work as they do in a style.

## Anchors

Kirana does not manage `anchor-name` for you. An anchor name must be unique on
the page, the same as an `id`, so name it where you know the element is unique:
a `css()` style on that element, or an inline `style` when the name depends on
data.
