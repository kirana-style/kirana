# Building a design system
Source: https://kirana.style/docs/advanced/design-system

# Building a design system

Kirana is a compiler, not a design system. This repository builds one on top of
it (the shadcn/ui component set, rebuilt), and its shape is worth copying.

## Six layers

<!-- ::figure-design-system -->

**1 · Scales.** Plain constants: the palette, spacing, type ramp, radii,
durations. Inlined, so they cost nothing.
[`@kirana-style/preset-scales`](/docs/tokens/preset-scales) gives you Tailwind's.

**2 · Semantic tokens.** What the scales _mean_, such as `background`,
`foreground` and `primary`, as variable tokens, every colour a `light-dark()`
pair. This is the layer a theme overrides.
[Semantic tokens](/docs/tokens/semantic-tokens).

**3 · Conditions.** The relations components share (a menu item reading its
menu's state), context tokens a parent hands down (`iconSize`, `sidebarWidth`),
and the keyframes. Declared once, in one module each.

**4 · Recipes.** Variant tables for the components that have variants, plus the
shared chrome (a focus ring, an overlay surface, a menu surface), so twelve
components do not each invent their own.

**5 · Primitives.** Thin elements such as `Box`, `Stack` and `Text` that carry
the system's defaults and nothing else.

**6 · Components.** The real thing. Each takes `sx` last, so callers can override
without forking.

## Rules that keep it from drifting

- **A colour is one `light-dark()` pair**, written once. No dark variant anywhere.
- **A parent hands values down through context tokens**, never through class
  names it hopes a child reads.
- **A component's variants live in its recipe**, not scattered through the JSX.
- **New things have one home**: a scale value goes to the scales, a per-mode
  colour to the semantic layer, a parent-to-child value to the context tokens, a
  group or peer to the relations.
- **Global CSS is the last resort**, for markup you do not render.

## What the compiler gives you here

A design system is mostly discipline, and the compiler enforces some of it for
you: `sx` that goes nowhere is a warning, a relation without an anchor is an
error, two conditions that could both apply are reported, and a mixed
logical/physical box is flagged. Those are precisely the mistakes that make a
system slowly stop being one.
