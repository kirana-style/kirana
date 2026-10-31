# Fallback values
Source: https://site.kirana-style.workers.dev/docs/styling/fallbacks

# Fallback values

A browser drops a declaration whose value it does not understand and keeps the
one before it. `firstThatWorks()` uses that: you list the values a property
should try, the preferred first, and Kirana writes the property once per value.

```tsx
import { css, firstThatWorks } from "@kirana-style/core"

const screen = css({
  minHeight: firstThatWorks("100dvh", "100vh"),
  position: firstThatWorks("sticky", "-webkit-sticky"),
})
```

```css
.k7U_ulId {
  min-height: 100vh;
  min-height: 100dvh;
}
```

The preferred value is written last because the last declaration a browser
understands is the one it keeps. The arguments go in reading order (the value
you want, then what to fall back to), the same order as StyleX's helper and as
`var(--x, fallback)`.

## Where it works

Anywhere a property takes a value: inside conditions, recipes, `keyframes()`
frames, [`positionTry()`](/docs/styling/anchor-positioning) blocks and
[`viewTransition()`](/docs/styling/view-transitions) parts. Every value goes
through the same checks as a value written alone, so tokens resolve, units are
checked and shorthands expand:

```tsx
const ink = css({ color: firstThatWorks(brand.ink, "#334") })
const pad = css({
  padding: firstThatWorks("max(1rem, env(safe-area-inset-top))", "1rem"),
})
```

The run is one atom. Its class name covers every value in order, so two styles
with the same run share one class, and swapping the order is a different style.
Hover, `kirana-style trace` and `kirana-style analyze` show it as `firstThatWorks(100dvh, 100vh)`.

## What it refuses

| Written                                            | Diagnostic                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `firstThatWorks()`                                 | `invalid-fallback`: it needs at least one value                       |
| `firstThatWorks(firstThatWorks(a, b), c)`          | `invalid-fallback`: runs do not nest                                  |
| `firstThatWorks(value, "100vh")`, value at runtime | `invalid-fallback`: every value must be known at build time           |
| `padding: firstThatWorks("1rem 2rem", "var(--p)")` | `invalid-fallback`: the values must set the same longhands            |
| `"--gap": firstThatWorks("1rem", "16px")`          | `fallback-on-variable` (warning): a custom property accepts any value |

The longhand rule exists because a shorthand with a `var()` cannot be split at
build time: one value would set four longhands and the other the shorthand, and a
browser would keep a fallback for some sides and the preferred value for others.
A custom property never falls back, because the browser accepts any text for it;
put the fallback where the variable is read, `var(--gap, 16px)`.

One value is that value: `firstThatWorks("grid")` is `"grid"`, which keeps code
migrated from StyleX working.

## A token, else another: `fallback()`

`firstThatWorks()` picks by what the browser understands. `fallback()` picks by
what the element sets: the first of its tokens that has a value, else the next,
else the last value. It compiles to one `var()` chain, read where it is used:

```tsx
import { css, defineTokens, fallback } from "@kirana-style/core"

export const fade = defineTokens("fade", {
  size: { syntax: "*" },
  top: { syntax: "*" },
})

const region = css({
  paddingBlockStart: fallback(fade.top, fade.size, "min(12%, 2.5rem)"),
})
const deep = css({ [fade.size]: "6rem" })
const shallowTop = css({ [fade.top]: "0.5rem" })
```

```css
.kT_tkQA {
  padding-block-start: var(--kveHnr, var(--kvieC4, min(12%, 2.5rem)));
}
```

A region with `deep` gets 6rem at the top, one with both gets 0.5rem, and one with
neither gets the default. Each knob is a token an element may leave unset: the
[universal syntax with no value](/docs/tokens/overview#registered-tokens). A token
with a value is never unset, so nothing after it would ever be read.

A token's default cannot do this. A variable token's default is resolved on
`:root`, so a default that reads another token sees the root's value, never the
element's.

The result works wherever a token does: in property values, conditions,
recipes, template literals, `keyframes()` frames and a token's default. It is a
value, not a variable, so it cannot be a key. Outside a style it is the chain's
text, for an inline style or a chart's option. To animate the result, assign it
to a registered token and animate that:

```tsx
const reveal = keyframes({
  from: { [fade.depth]: "0px" },
  to: { [fade.depth]: fallback(fade.size, "2.5rem") },
})
```

The last value may be a plain value, a token or another chain, and it is checked
against the property, so `padding: fallback(fade.top, "red")` is `invalid-value`.

| Written                                       | Diagnostic                                                     |
| --------------------------------------------- | -------------------------------------------------------------- |
| `fallback(fade.top)`                          | `invalid-fallback`: it needs a value to fall back to           |
| `fallback("1rem", fade.top)`                  | `invalid-fallback`: every value but the last must be a token   |
| `fallback(theme.gap, "1rem")`                 | `invalid-fallback`: the token always has a value               |
| `fallback(fade.top, value)`, value at runtime | `invalid-fallback`: the last value must be known at build time |
| `fallback(fade.top, firstThatWorks(a, b))`    | `invalid-fallback`: a chain ends in one value                  |
| `{ [fallback(fade.top, "1rem")]: "2rem" }`    | `token-not-variable`: the chain is a value, not a variable     |

## When to use `supports()` instead

`firstThatWorks()` fits one property whose newer value a browser either parses or
drops. When several properties have to change together, or the old browser parses
the new value but renders it wrongly, use a [`supports()`](/docs/styling/conditions)
condition instead.
