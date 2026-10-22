# Values known at runtime
Source: https://kirana.style/docs/styling/dynamic

# Values known at runtime

Kirana compiles styles, but some values are only known when the component runs: a
progress width, a colour from data, a variant from props. Those are fine to write
where you write everything else: the compiler classifies each one and picks a
representation.

## Three classes of value

**Static.** Known at build time. Compiles to a class. Nothing else happens.

**Finite dynamic.** A choice between a known set of static values:

```tsx
<div sx={css({ color: tone === "danger" ? "crimson" : "black" })} />
```

Both values are compiled to classes, and the element gets a class _expression_, a
ternary between two class strings. Still no CSS at runtime.

**Open dynamic.** A value the compiler cannot enumerate:

```tsx
<div sx={css({ inlineSize: `${percent}%` })} />
```

The declaration becomes `inline-size: var(--k…)`, and the element gets that custom
property in its `style` attribute. One rule, any value, and the browser does the
rest. The compiler reports it as `dynamic-bridged` (informational), so you can see
where runtime values enter your styles.

<!-- ::figure-dynamic -->

## The branch budget

A finite dynamic value with too many branches would multiply classes, so there is
a budget: 16 branches by default, configurable as
[`dynamic.branchBudget`](/docs/reference/config). Past it, the compiler stops and
reports `branch-budget-exceeded` rather than emitting a combinatorial explosion.
Usually that is a sign the value should be a bridge, or a
[recipe](/docs/styling/recipes).

## What ships

A module that needs runtime merging or a bridge imports a private helper that is
under 1.1 kB minified and gzipped. It merges class strings and sets custom
properties. It never parses styles and never generates CSS.

Modules with only static styles import nothing.

## What is not allowed

Two things the compiler refuses, because they would mean generating styles at
runtime:

```tsx
css({ [key]: value }) // error: dynamic-key
css({ ...someObject }) // error: dynamic-spread
```

A style's _shape_ is fixed at build time; its _values_ may vary. If you need a
different property depending on state, write both and choose between handles:

```tsx
<div sx={vertical ? styles.vertical : styles.horizontal} />
```

## Keeping runtime values honest

- Prefer a finite set when there is one: a class expression costs nothing in the
  browser, a bridge costs a custom property.
- Bridge lengths, colours and numbers: values that vary continuously.
- If a page reports many `dynamic-bridged` values you did not expect, something
  that could be static is not: usually a token read through an intermediate
  variable the evaluator cannot follow.
