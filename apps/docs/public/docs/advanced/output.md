# The output
Source: https://kirana.style/docs/advanced/output

# The output

## One declaration per rule

```css
@layer kirana.atoms {
  .k5O_23ai {
    display: flex;
  }
  .kJ_1O3s {
    gap: 0.75rem;
  }
  .k44_MaxI {
    background-color: light-dark(oklch(0.21 0 0), oklch(0.92 0 0));
  }
}
```

Every rule is one class with one declaration, at specificity (0,1,0), shared by
every module that writes that declaration ([why](/docs/start/how-it-works#the-pipeline)).

One declaration can still reach several rules (the same colour under `:hover`,
under an attribute and at rest), and there the writer gives one rule all three
selectors:

```css
.k5O_u3uh,
.k5O-KFHz_u3uh:where(:hover),
.k5O-Ikox_u3uh:where(:focus) {
  display: block;
}
```

It does that only when no rule in between decides the same property, because
inside the layer the order of the rules **is** the
[precedence ladder](/docs/styling/precedence). A merge that could move a rule past
a competing declaration is not taken.

## Class names

<!-- ::figure-class-name -->

A name is `{prefix}{property code}[-{target}][-{conditions}]_{value}`. The prefix is
[configurable](/docs/config/reference) and defaults to `k`; the property code is
an index into the property table; then come optional 3- and 4-character hashes for
a pseudo-element or contextual target and for the condition set; and after the `_`,
four characters of the value's hash.

Names are content-derived, so they are stable across builds and machines, and two
applications with different prefixes can share a page.

The widths are fixed and never grow. A name that depended on what else the project
contained would change as the project grew, which would break incremental builds;
so if two values on one property ever took the same name, the build stops with
`class-name-collision` instead of guessing. Four characters make that about one
build in two thousand for an application the size of the ones this compiler is
tested on.

## Conditions in the selector

Conditions compile into the selector or the at-rule, and order inside the layer
carries the [ladder](/docs/styling/precedence), with no `!important`, no
specificity tricks and no sublayers per bucket.

## Determinism

The same sources produce byte-identical CSS: same rule order, same names,
independent of thread count or file-system order. Which means a content hash is
meaningful, a diff in CI means a real change, and two developers see the same
output.

## Minification and targets

The compiler's own writer minifies, so your values reach the browser as you wrote
them: a colour is never re-serialized into another colour space, and `calc()` is
never "simplified".

Lightning CSS runs only when your configured [`targets`](/docs/config/reference)
are below the default floor, and then only to lower what those browsers need.
Lowering is reported as `target-lowering` so you know a modern feature was
rewritten.

## Dead styles

A style nothing references emits nothing. Tokens, keyframes and recipes all follow
the same rule, so an imported preset costs nothing until it is used.

## What ships to the browser

- The stylesheet.
- Class strings in your JavaScript.
- The private runtime (under 1.1 kB, gzipped) **only** in modules that merge at
  runtime or bridge a value.

There is no style engine, no CSS-in-JS injection, and no rule generation at
runtime.
