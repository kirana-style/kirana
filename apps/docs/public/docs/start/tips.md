# Habits for a new project
Source: https://kirana.style/docs/start/tips

# Habits for a new project

These come from building every shadcn/ui component on Kirana, migrating the
same three applications from StyleX and from Tailwind, and diffing the results
element by element. Each one is here because not doing it cost us a bug.

## Structure

**1. One `styles` object per module, named by part.** Declare styles after the
imports and name each after the part it styles — the element's `data-slot` is a
good name (`card-header` → `styles.cardHeader`). Markup stays readable because
the styling is not inline in it, and a search for the name finds both ends.

```tsx
const styles = {
  card: css({ display: "flex", flexDirection: "column", gap: space[6] }),
  cardHeader: css({ display: "grid", gap: space[2] }),
}
```

**2. Components take `sx?: Sx`, and put it last.** `sx={[styles.card, sx]}`: an
`sx` array is merge order, so the caller's styles go last and win. Never take a
`className` for styling.

**3. Take `sx` out of the rest spread.** A wrapper written
`({ ...props }) => <Menu.Trigger {...props} />` carries `sx` inside the spread,
where nothing compiles it. Write `({ sx, ...props })` and pass it on. The
compiler reports a wrapper that drops it (`unused-sx`).

**4. Installed components do not read `sx`.** Base UI parts and anything else
from `node_modules` take `{...props(styles.x, sx)}` instead
(`import { props } from "@kirana-style/core"`). Passing them `sx` is
`sx-on-external-component`.

## Values

**5. Start with plain values; adopt scales when they repeat.** You do not need a
preset to begin. When you want a vocabulary,
[`@kirana-style/preset-scales`](/docs/tokens/preset-scales) is Tailwind v4's, and a
token nothing references emits nothing.

**6. Put product decisions in your own tokens.** `primary`, `muted` and `border`
are yours; define them once as [semantic tokens](/docs/tokens/semantic-tokens),
each colour a `light-dark()` pair, and set the theme's `color-scheme` on
`<html>`, not `<body>` — the root decides scrollbars and an iframe's canvas.

**7. A font size comes with its line height.** Set `fontSize.sm` and
`lineHeight.sm` together. A size without its line height was the most common
drift in our ports.

**8. Name the longhands you set.** `padding: 0` on a component whose base sets
`paddingInlineStart` sits beside it instead of replacing it
(`mixed-logical-physical`). Prefer logical properties (`paddingInline`,
`marginBlockStart`) throughout, so right-to-left works without a second style.

## Overrides and states

**9. Override under the same condition.** Styles
[merge per entry](/docs/styling/merging): a caller's `alignSelf: "auto"` replaces
the base entry and keeps the component's `[data-orientation="vertical"]` one. To
win there too, write it under that condition, or clear the rest with
`{ "*": null, base: "auto" }`. Omitting a key keeps it; `null` removes it.

**10. Nest the winner inside the other condition.** When two conditions of the
same kind can match together and set different values, the compiler reports
`ambiguous-precedence` rather than letting source order decide. Nest one inside
the other (`'[aria-invalid="true"]': { base: x, "[data-checked]": y }`), or, when
the library never sets both, list the pair in
[`conditions.exclusive`](/docs/config/reference). Do not re-level the diagnostic
to hide a tie; twice it hid a real bug.

**11. Put the relation anchor where the state lives.** `rel.within(sel)` reads an
ancestor, `rel.after(sel)` an earlier sibling. The anchor goes on the element
whose state is read, not on the element being styled.
[Relations](/docs/styling/relations).

**12. A parent's rule ranks below the child's own.** A
[`select`](/docs/styling/contextual) block styles children from a parent, below
their own styles, so an icon that sets its own size keeps it without a guard. When
the parent must win — a field forcing its label to full width — let the child
read the parent: a relation, or a condition on its own position
(`':is([data-slot="field"] > *)'`).

**13. Animate the property you set.** `translate`, `scale` and `rotate` are
properties of their own; `transitionProperty: "transform"` does not cover them.

## Runtime values

**14. Prefer a finite set.** `tone === "danger" ? a : b` compiles to a choice
between two classes and costs nothing. Bridge only what varies continuously — a
width in percent, a colour from data — and read `dynamic-bridged` in the report
to see where runtime values enter. [Values known at runtime](/docs/styling/dynamic).

## Checking

**15. Let the tools answer "why".**

- `kirana check` in CI: every diagnostic, with an exit code.
- `kirana trace <file>:<line> <property>` when a value is not the one you
  expected: every entry, the winner, and the ladder step that decided it.
- To verify a port or a refactor, compare **computed styles**, not screenshots,
  in both colour schemes and at several widths. A 1 px border, an easing curve
  and a missing hover state were all invisible in screenshots and obvious in a
  diff. [Conformance](/docs/advanced/conformance).
