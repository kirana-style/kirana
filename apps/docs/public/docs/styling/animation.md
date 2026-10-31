# Animation
Source: https://site.kirana-style.workers.dev/docs/styling/animation

# Animation

## Keyframes

`keyframes()` returns a name you can use as `animationName` from any module:

```tsx
import { css, keyframes } from "@kirana-style/core"

const pulse = keyframes({
  "0%, 100%": { opacity: 1 },
  "50%": { opacity: 0.5 },
})

const dot = css({
  animationName: pulse,
  animationDuration: "2s",
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-in-out",
})
```

The name is hashed like a class, so two modules that define the same frames share
one `@keyframes` rule, and a set of frames nothing references emits nothing. That
holds for a library too: a production build with the Vite or Rolldown plugin writes
a library's animations only if the finished bundle still uses them, so importing a
scale from a module that also declares keyframes ships none of them.

## Transitions

Transitions are ordinary declarations, and the thing worth saying is about the
property you name:

```tsx
const panel = css({
  translate: { base: "0 -4px", "[data-open]": "0 0" },
  opacity: { base: 0, "[data-open]": 1 },
  transitionProperty: "translate, opacity", // not "transform"
  transitionDuration: "150ms",
})
```

**Animate the property you actually set.** `translate`, `scale` and `rotate` are
separate properties from `transform`, and a transition on it does not interpolate
them. This is one of the most common reasons an animation silently
does nothing.

## Animating a custom property

A custom property does not interpolate unless the browser knows its type. Register
it by giving the token a syntax, and it becomes animatable:

```tsx
import { defineTokens } from "@kirana-style/core"

export const fade = defineTokens("fade", {
  stop: { value: "0%", syntax: "<length-percentage>", inherits: false },
})
```

That emits an `@property` rule, so a transition or keyframe on `--fade-stop`
animates smoothly instead of jumping. A registered token may also be a keyframe
key, and a frame takes a custom property by its name, as `css()` does:

```tsx
const reveal = keyframes({
  from: { "--scroll-fade-t": "0px" },
  to: { "--scroll-fade-t": "24px" },
})
```

## Respecting motion preferences

`prefers-reduced-motion` is a condition like any other, and it ranks above width
queries:

```tsx
const item = css({
  transitionDuration: {
    base: "150ms",
    "@media (prefers-reduced-motion: reduce)": "0s",
  },
})
```

## Entry and exit states

Libraries that animate elements in and out usually expose attributes for the two
edges, such as `[data-starting-style]` and `[data-ending-style]`. Those are
plain attribute conditions. Because they never appear at the same time but the
selectors cannot prove it, declare them as exclusive once in
[`conditions.exclusive`](/docs/reference/config), and the compiler stops asking
which of the two wins.
