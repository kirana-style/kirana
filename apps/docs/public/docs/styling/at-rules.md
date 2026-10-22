# At-rules
Source: https://kirana.style/docs/styling/at-rules

# At-rules

An at-rule that a style depends on is written by Kirana, under a hashed name and
only when something uses it. An at-rule that belongs to the whole page stays in
a stylesheet, where CSS already says it well.

| At-rule                             | With Kirana                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `@media`, `@container`, `@supports` | [Conditions](/docs/styling/conditions): `media()`, `container()`, `supports()`     |
| `@keyframes`                        | [`keyframes()`](/docs/styling/animation)                                           |
| `@position-try`                     | [`positionTry()`](/docs/styling/anchor-positioning)                                |
| `@counter-style`                    | [`counterStyle()`](#counter-styles), below                                         |
| `@property`                         | A [registered token](/docs/tokens/overview#registered-tokens), `{ value, syntax }` |
| `@layer`                            | Kirana's own layers, and [yours around them](/docs/config/layers)                  |
| View-transition parts               | [`viewTransition()`](/docs/styling/view-transitions)                               |
| `@font-face`, `@page`               | [A stylesheet](#in-a-stylesheet)                                                   |
| `@custom-media`                     | [A `media()` constant](#a-named-media-query), since browsers do not read it yet    |

## Counter styles

`counterStyle()` defines how a list or a counter writes its numbers: ticks,
letters, roman numerals, any symbols you choose.

```tsx
import { counterStyle, css } from "@kirana-style/core"

export const check = counterStyle({
  system: "cyclic",
  symbols: '"✓"',
  suffix: '" "',
})

export const steps = css({ listStyleType: check })
export const label = css({
  "::before": { content: `counter(step, ${check}) ". "` },
})
```

The result is the rule's name, `kc…`, for a list's marker or a counter. The rule
ships once, in `kirana.tokens`, and only if a style uses it:

```css
@layer kirana.tokens {
  @counter-style kc4HMO {
    system: cyclic;
    symbols: "✓";
    suffix: " ";
  }
}
```

The keys are the CSS descriptors in camel case:

| Descriptor                   | What it sets                                  |
| ---------------------------- | --------------------------------------------- |
| `system`                     | How the symbols count: `cyclic`, `additive` … |
| `symbols`, `additiveSymbols` | The symbols, each a quoted string             |
| `prefix`, `suffix`           | What comes before and after the marker        |
| `negative`, `range`, `pad`   | Negative numbers, the range drawn, padding    |
| `fallback`, `speakAs`        | Another style outside the range; speech       |

Each value is CSS text, so a symbol keeps its quotes. One counter style can build
on another, and the other ships with it:

```tsx
export const bracketed = counterStyle({
  system: `extends ${check}`,
  prefix: '"("',
  suffix: '") "',
})

export const roman = counterStyle({
  system: "additive",
  additiveSymbols: '10 "X", 5 "V", 1 "I"',
  range: "1 39",
  fallback: check,
})
```

### Why not a stylesheet

A counter style in a global stylesheet has a global name that any other can
collide with. It ships whether a page uses it or not. And a name misspelt in
`listStyleType` gives no error: the list quietly falls back to decimal numbers.
With `counterStyle()` the name is a value your editor completes and the compiler
checks.

### What the compiler checks

A browser drops a broken counter style without a word, so `invalid-counter-style`
reports each way it breaks:

- a key that is not a descriptor (`color`);
- a value that reads a custom property, which descriptors cannot (a variable token);
- a value that is empty, or not CSS, or only known at runtime;
- a system without what it draws with: most need `symbols`, an additive one
  needs `additiveSymbols`, and one that extends another style takes neither.

An inlined token works as a value, since it is plain text by then. A system newer
than the compiler is left to the browser.

## In a stylesheet

`@font-face` and `@page` belong to the page rather than to an element, so they
stay in CSS, imported once from your entry point.

```css
/* src/fonts.css */
@font-face {
  font-family: "Inter";
  src: url("./fonts/inter.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}

@page {
  margin: 2cm;
}
```

```tsx
// src/main.tsx
import "./fonts.css"
```

Your bundler resolves the font's `url()` and fingerprints the file. That works in
a stylesheet and cannot work from a value inside a module, which is why Kirana
has no `fontFace()`. A style then names the family like any other value, and a
[token](/docs/tokens/overview) can hold it:

```tsx
export const body = css({ fontFamily: "Inter, system-ui, sans-serif" })
```

These rules are not inside a layer, and they need not be: neither styles an
element, so they never compete with Kirana's atoms. Element styles of your own
that must sit beside Kirana's go in [a layer](/docs/config/layers).

## A named media query

`@custom-media` gives a media query a name, but no browser reads it yet. A
condition in a constant does the same today:

```tsx
// src/breakpoints.ts
import { media } from "@kirana-style/core"

export const tablet = media("(width >= 48rem)")
export const reducedMotion = media("(prefers-reduced-motion: reduce)")
```

```tsx
import { css } from "@kirana-style/core"
import { tablet } from "./breakpoints"

export const grid = css({
  gridTemplateColumns: { base: "1fr", [tablet]: "1fr 1fr" },
})
```

The compiler reads the constant across modules, so a query is written once and
every style that names it is checked.
