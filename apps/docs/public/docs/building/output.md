# The output
Source: https://kirana.style/docs/building/output

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
[configurable](/docs/reference/config) and defaults to `k`; the property code is
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

### Dense names

A production build can go further with
[`names: "dense"`](/docs/integrations/vite#dense-names). After every module has
compiled, the compiler knows every condition set and every value in the
application, so it can number them instead of hashing them:

- **Each condition hash becomes a code of one or two characters**, never three, so
  it is never mistaken for a target.
- **Each value hash becomes a code of one or two characters** from one numbering
  shared by every property. A runtime merge that unfolds a shorthand builds a
  longhand's name from the shorthand's value, so a value has to mean the same
  thing under every key.
- **The property code and the target stay.** They are what the runtime reads to
  merge, so merging works exactly as before and no lookup table ships.

The most used segments get the shortest codes. A code, once given, never changes
for the rest of the build, so a chunk renamed early stays valid while later modules
compile. The stylesheet keeps its rules in the same order; only the names in it
change.

Measured on the three applications of
[the benchmarks](/docs/project/benchmarks), Kirana 0.3.3 with
dense names makes the CSS 12 % smaller in gzip, and the CSS and
JavaScript a page downloads 2 % smaller, with cold builds
7 % slower. On this site, the stylesheet is 12.7 % smaller in
gzip and brotli.

Dense names stay opt-in for one reason besides the build time: a code goes to the
most used segments first, so when a new segment outranks an old one between two
deploys, names change in chunks whose source did not, and those chunks get new
content hashes and are downloaded again. A names manifest that keeps codes
across deploys would remove that, and with it the reason to keep them off.

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

Lightning CSS runs only when your configured [`targets`](/docs/reference/config)
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
