# Writing styles
Source: https://site.kirana-style.workers.dev/docs/styling/styles

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
grammar as MDN writes it:

```tsx
css({ display: "center" }) // error: invalid-value - a keyword display does not take
css({ padding: "-4px" }) // error: invalid-value - padding is never negative
css({ padding: color.accent }) // error: invalid-value - a colour token on a length
css({ margin: "1px;" }) // error: invalid-value - a stray semicolon
```

A property whose values are a fixed list of keywords warns about a word that is
not on the list (`display: "flx"`), with the nearest keyword in its help. Where a
property also takes names of your own, as `animationName: "spin"` and font
families do, any word is accepted, because it may be yours. A function the data
does not know is left alone, since it may be newer CSS than the data, and so is
whatever is inside a function's parentheses and a value made of `var()`.

## What the compiler checks

TypeScript checks property names and token names in your editor. Values are
typed from `csstype`, which suggests each property's keywords but accepts any
string, so a misspelt keyword is the compiler's to catch, not the editor's.

| Mistake                                                | Example                                | What happens                                                                |
| ------------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------- |
| A property that does not exist                         | `colr: "red"`                          | `unknown-property`, with the nearest property in its help                   |
| A condition that does not exist                        | `":hovr"`, `"md"`                      | `unknown-condition`, with the nearest one in its help                       |
| A length without its unit                              | `width: 5`                             | `unitless-length`, with a unit in its help                                  |
| A value the property never takes                       | `display: "center"`, `padding: "-4px"` | `invalid-value`                                                             |
| A misspelt keyword, where the values are a fixed list  | `display: "flx"`                       | a warning (KRN1211 `unknown-keyword`), with the nearest keyword in its help |
| A token that does not exist                            | `theme.accnt`                          | a type error, and `unknown-token`                                           |
| A headless library's state that does not exist         | `Switch.Root.chekced`                  | a type error, and `dynamic-key`                                             |
| A relation read with no anchor                         | `menu.within("[data-open]")` alone     | `relation-without-anchor`                                                   |
| A word in a property that also takes names of your own | `transitionProperty: "opactiy"`        | accepted, since it may be a name of yours                                   |
| A function newer than the data, or a `var()`           |                                        | accepted                                                                    |
| Dark mode as a nested `prefers-color-scheme` query     |                                        | compiles; the lint rule `no-dark-variant` reports it                        |
| A class helper joining class strings                   | `clsx(…)`                              | compiles; the strict lint rule `no-class-helpers` reports it                |
| A valid style on the wrong element                     |                                        | compiles; [`kirana-style trace`](/docs/tooling/debugging) shows what wins   |

Every code is in the [diagnostics reference](/docs/tooling/diagnostics), with
what to do about it.

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

`translate` and `transform` have no logical form. To centre an element, pair them
with a physical inset (`left: "50%"`, `translate: "-50% 0"`): a logical inset
changes side in right-to-left text while the translate keeps pulling the same way,
and the compiler warns about that pair too.

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
