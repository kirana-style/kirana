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

## When to use `supports()` instead

`firstThatWorks()` fits one property whose newer value a browser either parses or
drops. When several properties have to change together, or the old browser parses
the new value but renders it wrongly, use a [`supports()`](/docs/styling/conditions)
condition instead.
