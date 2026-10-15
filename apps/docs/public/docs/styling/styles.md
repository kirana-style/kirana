# Writing styles
Source: https://kirana.style/docs/styling/styles

# Writing styles

`css()` takes style objects and returns a handle. A handle is an opaque value:
you pass it to `sx`, merge it with others, or export it. It is not an object you
can read at runtime: by then it is a class string.

```tsx
import { css } from "@kirana-style/core"

const panel = css({
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
})
```

## Property names

Properties are camelCase: `backgroundColor`, `paddingInlineStart`, `gridTemplateColumns`.
Anything CSS knows about is allowed; anything else is an error
(`unknown-property`), so a typo fails the build instead of disappearing.

Custom properties are written as they are in CSS, in quotes:

```tsx
css({
  "--card-gap": "1rem",
  gap: "var(--card-gap)",
})
```

## Values

Values are strings and numbers, exactly as CSS reads them. Kirana does **not**
add units for you:

```tsx
css({ width: "5rem" }) // fine
css({ width: 5 }) // error: unitless-length
css({ flexGrow: 1 }) // fine - flex-grow takes a number
css({ zIndex: 10 }) // fine
```

The rule is the CSS rule: a property that takes a `<length>` needs a unit. A
property whose value is a plain number takes a plain number. Guessing `px` is how
a styling system ends up with values it cannot explain, so the compiler asks you
instead.

Invalid values are errors too (`invalid-value`), checked against the property's
real grammar:

```tsx
css({ display: "flx" }) // error: invalid-value
css({ margin: "1px;" }) // error: invalid-value - a stray semicolon
```

## Several objects, one handle

`css()` takes any number of arguments (objects, or handles you already made) and
merges them left to right:

```tsx
const base = css({ padding: "0.5rem" })
const wide = css(base, { paddingInline: "1.5rem" })
```

Merging follows the [merge rules](/docs/styling/merging): later entries replace
matching entries and leave the rest alone.

## Shorthands

Shorthands are expanded to longhands, so two styles that touch the same box merge
per side rather than wholesale:

```tsx
const a = css({ padding: "1rem" })
const b = css({ paddingTop: "2rem" })

<div sx={[a, b]} /> // 2rem on top, 1rem on the other three sides
```

A shorthand whose value cannot be split exactly (`border: "var(--line)"`, where
the value is one custom property) stays whole, and the compiler warns
(`unsplittable-shorthand`) because removing one of its longhands later cannot be
done precisely.

Mixing logical and physical longhands of the same box (`paddingLeft` and
`paddingInlineStart`) is allowed, but they are _different_ declarations, and when
the result could mislead the compiler says so (`mixed-logical-physical`).

## Where styles live

A handle is usually a module-level constant, because it compiles to a constant:

```tsx
const styles = {
  root: css({ … }),
  title: css({ … }),
}
```

Writing `css({ … })` inside a component body is fine too, since it still
compiles, but there is no reason to unless the style depends on a value only
known at render time, which is its own topic:
[dynamic values](/docs/styling/dynamic).

## Next

- [The `sx` prop](/docs/styling/sx): putting a handle on an element.
- [Conditions](/docs/styling/conditions): hover, breakpoints, attributes.
