---
title: Habits for a new project
description: The habits that would have saved us the most time on day one, learnt building and migrating three applications on Kirana.
section: building
order: 1
keywords: [tips, best practices, habits, conventions, from scratch, pitfalls]
---

# Habits for a new project

Fifteen habits from building every shadcn/ui component on Kirana and migrating
the same three applications from StyleX and from Tailwind. Each one is here
because skipping it cost us a bug.

<!-- ::figure-habits -->

## Structure

### 1. One `styles` object per module, named by part

Declare the styles after the imports, one per part. The element's `data-slot` is
a good name: `card-header` becomes `styles.cardHeader`, and a search for it finds
both ends.

```tsx
const styles = {
  card: css({ display: "flex", flexDirection: "column", gap: space[6] }),
  cardHeader: css({ display: "grid", gap: space[2] }),
}
```

### 2. Components take `sx`, and put it last

An `sx` array is merge order, so the caller's styles go last and win. A
`className` prop for styles is never needed.

```tsx do
<div sx={[styles.card, sx]} />
```

```tsx dont
<div sx={[sx, styles.card]} />
```

**Checked by** `sx-last`, in the [lint plugin](/docs/tooling/lint).

### 3. Take `sx` out of the rest spread

A wrapper that spreads its props carries `sx` inside the spread, where nothing
compiles it.

```tsx do
function Trigger({ sx, ...props }: Props) {
  return <Button sx={[styles.trigger, sx]} {...props} />
}
```

```tsx dont
function Trigger(props: Props) {
  return <Button {...props} />
}
```

**Checked by** `unused-sx`, which reports a wrapper that drops it.

### 4. Installed components do not read `sx`

Base UI parts and anything else from `node_modules` take compiled props:
`props` from `@kirana-style/core` turns styles into them.

```tsx do
<Menu.Popup {...props(styles.popup, sx)} />
```

```tsx dont
<Menu.Popup sx={styles.popup} />
```

**Checked by** `sx-on-external-component`.

## Values

### 5. Start with plain values; adopt scales when they repeat

You do not need a preset to begin. When you want a vocabulary,
[`@kirana-style/preset-scales`](/docs/tokens/preset-scales) is Tailwind v4's, and a
token nothing references emits nothing.

### 6. Put product decisions in your own tokens

`primary`, `muted` and `border` are yours. Define each once as a
[semantic token](/docs/tokens/semantic-tokens), a `light-dark()` pair.

Set the theme's `color-scheme` on `<html>`: the root decides the scrollbars and an
iframe's canvas.

```tsx do
export const theme = defineTokens("theme", {
  primary: "light-dark(oklch(0.21 0 0), oklch(0.92 0 0))",
})
```

```tsx dont
const button = css({
  backgroundColor: "oklch(0.21 0 0)",
})
```

### 7. A font size comes with its line height

A size without its line height was the most common drift in our ports.

```tsx do
css({
  fontSize: fontSize.sm,
  lineHeight: lineHeight.sm,
})
```

```tsx dont
css({ fontSize: fontSize.sm })
```

### 8. Name the longhands you set

Logical properties make right-to-left work without a second style. To replace a
longhand a component's base sets, name that longhand: a shorthand sits beside it
instead.

```tsx do
css({ paddingInlineStart: 0 })
```

```tsx dont
css({ padding: 0 })
```

**Checked by** `mixed-logical-physical`.

## Overrides and states

### 9. Override under the same condition

Styles [merge per entry](/docs/styling/merging). A plain value replaces the base
entry only, and the component's conditional entries still win under their
conditions. Omitting a key keeps it; `null` removes it.

```tsx do
alignSelf: {
  '[data-orientation="vertical"]': "auto",
}
```

```tsx dont
alignSelf: "auto"
```

To clear every entry first: `alignSelf: { "*": null, base: "auto" }`.

**Checked by** `override-keeps-conditions`, in the lint plugin.

### 10. Nest the winner inside the other condition

When two conditions of the same kind can match together and set different values,
the compiler reports them rather than letting source order decide. Twice, turning
the report off hid a real bug.

```tsx do
backgroundColor: {
  '[aria-invalid="true"]': {
    base: red,
    "[data-checked]": blue,
  },
}
```

```ts dont
// kirana.config.ts
diagnostics: {
  "ambiguous-precedence": "off",
}
```

When a library never sets both, name the pair in
[`conditions.exclusive`](/docs/config/reference) instead.

**Checked by** `ambiguous-precedence`.

### 11. Put the relation anchor where the state lives

A [relation](/docs/styling/relations) reads the state of the element that carries
its anchor, so the anchor goes on that element, not on the one being styled.

```tsx do
<div
  data-state={state}
  sx={[menu.anchor, styles.root]}
>
```

```tsx dont
<div data-state={state}>
  <div sx={[menu.anchor, styles.inner]}>
```

**Checked by** `relation-placement`.

### 12. A parent's rule ranks below the child's own

A [`select`](/docs/styling/contextual) block styles children from a parent, below
their own styles, so an icon that sets its own size keeps it. When the parent must
win, let the child read the parent.

```tsx do
label: css({
  width: {
    base: "auto",
    ':is([data-slot="field"] > *)': "100%",
  },
})
```

```tsx dont
field: css({
  [select.child("label")]: { width: "100%" },
})
```

### 13. Animate the property you set

`translate`, `scale` and `rotate` are properties of their own, and a transition on
`transform` does not cover them.

```tsx do
css({
  translate: "0 4px",
  transitionProperty: "translate",
})
```

```tsx dont
css({
  translate: "0 4px",
  transitionProperty: "transform",
})
```

## Runtime values

### 14. Prefer a finite set

A choice between known values compiles to a choice between classes and costs
nothing. Bridge only what varies continuously, such as a width in percent; the
`dynamic-bridged` report shows where runtime values enter. See
[values known at runtime](/docs/styling/dynamic).

```tsx do
<div
  sx={css({
    color: tone === "danger" ? "crimson" : "black",
  })}
/>
```

```tsx dont
// "crimson" or "black", known only at runtime
<div sx={css({ color })} />
```

**Checked by** `finite-bridge`, in the lint plugin's `strict` config.

## Checking

### 15. Let the tools answer "why"

`kirana-style check` reports every diagnostic with an exit code, for CI.
`kirana-style trace` answers when a value is not the one you expected: every
entry, the winner, and the step of the ladder that decided it.

```console
$ kirana-style check src
$ kirana-style trace src/card.tsx:12 minHeight
```

To verify a port or a refactor, compare **computed styles**, not screenshots, in
both colour schemes and at several widths. A 1 px border, an easing curve and a
missing hover state were all invisible in screenshots and obvious in a diff. See
[conformance](/docs/advanced/conformance).
