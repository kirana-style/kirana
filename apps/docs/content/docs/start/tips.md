---
title: Habits for a new project
description: The habits that would have saved us the most time on day one, learnt building and migrating three applications on Kirana.
section: building
order: 1
keywords: [tips, best practices, habits, conventions, from scratch, pitfalls]
---

# Habits for a new project

These come from building every shadcn/ui component on Kirana, migrating the
same three applications from StyleX and from Tailwind, and diffing the results
element by element. Each one is here because not doing it cost us a bug.

Each habit is a rule, why it matters, what to write and what not to, and the
check that catches it when there is one.

## Structure

### 1. One `styles` object per module, named by part

Declare styles after the imports and name each after the part it styles, so the
markup stays readable and a search for the name finds both ends. The element's
`data-slot` is a good name: `card-header` becomes `styles.cardHeader`.

```tsx
const styles = {
  card: css({ display: "flex", flexDirection: "column", gap: space[6] }),
  cardHeader: css({ display: "grid", gap: space[2] }),
}
```

### 2. Components take `sx?: Sx`, and put it last

An `sx` array is merge order, so the caller's styles go last and win.

| Do                       | Don't                                                      |
| ------------------------ | ---------------------------------------------------------- |
| `sx={[styles.card, sx]}` | `sx={[sx, styles.card]}`, or a `className` prop for styles |

**Checked by** `sx-last`, in the [lint plugin](/docs/tooling/lint).

### 3. Take `sx` out of the rest spread

A wrapper that spreads its props carries `sx` inside the spread, where nothing
compiles it.

| Do                                      | Don't                                           |
| --------------------------------------- | ----------------------------------------------- |
| `({ sx, ...props })`, then pass `sx` on | `({ ...props }) => <Menu.Trigger {...props} />` |

**Checked by** `unused-sx`, which reports a wrapper that drops it.

### 4. Installed components do not read `sx`

Base UI parts and anything else from `node_modules` take compiled props instead.

| Do                                                                 | Don't                             |
| ------------------------------------------------------------------ | --------------------------------- |
| `{...props(styles.x, sx)}`, with `props` from `@kirana-style/core` | `sx={styles.x}` on a Base UI part |

**Checked by** `sx-on-external-component`.

## Values

### 5. Start with plain values; adopt scales when they repeat

You do not need a preset to begin. When you want a vocabulary,
[`@kirana-style/preset-scales`](/docs/tokens/preset-scales) is Tailwind v4's, and a
token nothing references emits nothing.

### 6. Put product decisions in your own tokens

`primary`, `muted` and `border` are yours: define them once as
[semantic tokens](/docs/tokens/semantic-tokens), each colour a `light-dark()` pair.

| Do                                                                                             | Don't              |
| ---------------------------------------------------------------------------------------------- | ------------------ |
| Set the theme's `color-scheme` on `<html>`: the root decides scrollbars and an iframe's canvas | Set it on `<body>` |

### 7. A font size comes with its line height

A size without its line height was the most common drift in our ports.

| Do                                                 | Don't                         |
| -------------------------------------------------- | ----------------------------- |
| `fontSize: fontSize.sm, lineHeight: lineHeight.sm` | `fontSize: fontSize.sm` alone |

### 8. Name the longhands you set

Prefer logical properties throughout, so right-to-left works without a second
style.

| Do                                  | Don't                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `paddingInline`, `marginBlockStart` | `padding: 0` on a component whose base sets `paddingInlineStart`: it sits beside it instead of replacing it |

**Checked by** `mixed-logical-physical`.

## Overrides and states

### 9. Override under the same condition

Styles [merge per entry](/docs/styling/merging): a caller's `alignSelf: "auto"`
replaces the base entry and keeps the component's vertical one. Omitting a key
keeps it; `null` removes it.

| Do                                                                                                | Don't                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `{ '[data-orientation="vertical"]': "auto" }`, or `{ "*": null, base: "auto" }` to clear the rest | `alignSelf: "auto"` alone, expecting it to win under the component's conditions |

**Checked by** `override-keeps-conditions`, in the lint plugin.

### 10. Nest the winner inside the other condition

When two conditions of the same kind can match together and set different
values, the compiler reports them rather than letting source order decide. Do not
re-level the diagnostic to hide a tie; twice it hid a real bug.

| Do                                                                                                                                                            | Don't                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `'[aria-invalid="true"]': { base: x, "[data-checked]": y }`, or the pair in [`conditions.exclusive`](/docs/config/reference) when the library never sets both | Turning the diagnostic off |

**Checked by** `ambiguous-precedence`.

### 11. Put the relation anchor where the state lives

`rel.within(sel)` reads an ancestor and `rel.after(sel)` an earlier sibling, so
the anchor goes on the element whose state is read, not on the element being
styled. See [relations](/docs/styling/relations).

### 12. A parent's rule ranks below the child's own

A [`select`](/docs/styling/contextual) block styles children from a parent, below
their own styles, so an icon that sets its own size keeps it without a guard.

| Do                                                                                                                                                 | Don't                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| When the parent must win (a field forcing its label to full width), let the child read the parent: a relation, or `':is([data-slot="field"] > *)'` | A `select` block that fights the child's own size |

### 13. Animate the property you set

`translate`, `scale` and `rotate` are properties of their own.

| Do                                | Don't                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| `transitionProperty: "translate"` | `transitionProperty: "transform"`, which does not cover them |

## Runtime values

### 14. Prefer a finite set

A choice between known values compiles to a choice between classes and costs
nothing. Bridge only what varies continuously, such as a width in percent or a
colour from data, and read `dynamic-bridged` in the report to see where runtime
values enter. See [values known at runtime](/docs/styling/dynamic).

| Do                          | Don't                                         |
| --------------------------- | --------------------------------------------- |
| `tone === "danger" ? a : b` | A bridged value for something with two states |

**Checked by** `finite-bridge`, in the lint plugin's `strict` config.

## Checking

### 15. Let the tools answer "why"

- `kirana-style check` in CI: every diagnostic, with an exit code.
- `kirana-style trace <file>:<line> <property>` when a value is not the one you
  expected: every entry, the winner, and the ladder step that decided it.
- To verify a port or a refactor, compare **computed styles**, not screenshots,
  in both colour schemes and at several widths. A 1 px border, an easing curve
  and a missing hover state were all invisible in screenshots and obvious in a
  diff. See [conformance](/docs/advanced/conformance).
