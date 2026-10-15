# View transitions
Source: https://kirana.style/docs/styling/view-transitions

# View transitions

During a view transition the browser draws an element's old and new states in
four pseudo-elements, and `viewTransition()` styles them for every element of one
transition class:

- `::view-transition-group`
- `::view-transition-image-pair`
- `::view-transition-old`
- `::view-transition-new`

```tsx
import { css, keyframes, media, viewTransition } from "@kirana-style/core"

const fadeOut = keyframes({ to: { opacity: 0 } })
const slideIn = keyframes({ from: { translate: "0 1rem" } })

export const slide = viewTransition({
  old: { animationName: fadeOut, animationDuration: "150ms" },
  new: {
    animationName: slideIn,
    animationDuration: {
      base: "250ms",
      [media("(prefers-reduced-motion: reduce)")]: "0s",
    },
  },
})
```

The result is a class, `kw…`, that names itself as the element's
`view-transition-class`. The parts select every element of that class:

```css
@layer kirana.tokens {
  .kwBm2s {
    view-transition-class: kwBm2s;
  }
  ::view-transition-old(*.kwBm2s) {
    animation-name: kfBcwa;
    animation-duration: 150ms;
  }
  ::view-transition-new(*.kwBm2s) {
    animation-name: kfWkJE;
    animation-duration: 250ms;
  }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-new(*.kwBm2s) {
      animation-duration: 0s;
    }
  }
}
```

## Using it

The value is a style handle and a class name at the same time. Put it in `sx`
next to the element's other styles:

```tsx
<li sx={[card, slide]} style={{ viewTransitionName: `item-${item.id}` }} />
```

or pass it where a framework asks for a transition class, such as React's
`<ViewTransition share={slide}>`.

Kirana does not set `view-transition-name`. The browser needs it to be unique
among the elements taking part in one transition, so it usually comes from data
(an id, a slug) and belongs where that data is.

## The parts

| Key         | Pseudo-element                   | Typical use                                 |
| ----------- | -------------------------------- | ------------------------------------------- |
| `group`     | `::view-transition-group()`      | the size and position animation, its timing |
| `imagePair` | `::view-transition-image-pair()` | isolation and blending of the two images    |
| `old`       | `::view-transition-old()`        | how the old state leaves                    |
| `new`       | `::view-transition-new()`        | how the new state arrives                   |

Each part is a style object. A property may be conditional on `media()` or
`supports()`; the pseudo-elements have no hover or attribute state, so other
conditions are `invalid-view-transition`, as is a key other than these four.
Values take tokens, keyframes and [`firstThatWorks()`](/docs/styling/fallbacks).

Like keyframes, the class is hashed from its parts, so the same transition
defined twice is one rule, and it ships only where something uses it.
