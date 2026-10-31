# How it works
Source: https://site.kirana-style.workers.dev/docs/start/how-it-works

# How it works

Kirana is a compiler. It reads your modules at build time, works out every style
they can produce, writes one stylesheet, and rewrites the modules to reference
classes instead of style objects.

## The pipeline

<!-- ::figure-pipeline -->

**1 · Prefilter.** Most files in an application have nothing to do with styling.
Before parsing anything, the adapter skips any module whose text contains neither
`@kirana-style/`, an `sx` attribute, nor a call of a relation's read such as
`.within(`, so the compiler's work scales with the number of styled modules, not
with the size of the dependency graph.

**2 · Evaluate.** The modules that survive are parsed, and the parts that feed a
style are evaluated by a restricted evaluator: constants, imported token values,
template literals, simple functions. It follows imports across files, so a token
defined in one module and used in another is a build-time value. Anything it
cannot evaluate statically is reported rather than guessed at.

**3 · Normalise.** Declarations are expanded to longhands and normalised, so
`padding: "1rem"` and `paddingTop: "1rem"` compare as the same kind of thing, and
`margin` written twice in two modules merges per side rather than per shorthand.

**4 · Atomise.** Each declaration becomes one atom (one CSS rule with one
declaration), named by hashing the property, the value and the conditions. Two
modules that write `display: flex` get the same class. The stylesheet grows with
distinct declarations, not with components.

**5 · Order.** Atoms are placed in layers, and inside the layer their order comes
from the [precedence ladder](/docs/styling/precedence). Specificity is not used to
express intent: every rule is a single class.

**6 · Rewrite.** `css({ … })` becomes a class string, and `sx` becomes
`className`. A value known only at runtime becomes either a choice between class
strings or a custom-property bridge.

## What reaches the browser

- **One stylesheet**, containing the atoms your application actually uses.
- **Class strings** in your JavaScript.
- **No style engine.** Nothing parses styles, computes classes, or injects CSS at
  runtime.

The only runtime code is a private helper under 1.1 kB, and it is included only when
a module needs it: when styles are merged at runtime, or a value is bridged
through a custom property. It merges class strings; it never generates CSS.

## In development

The adapter keeps a compiler session alive. When you save a file it recompiles
that module, updates the stylesheet and pushes it over Vite's hot channel, so the
page restyles without reloading. Diagnostics appear in the terminal as warnings
and errors, with the file, line and a suggested fix.

## In a build

The same session produces the final stylesheet, minified through Lightning CSS and
lowered for the browser targets you configured. The output is deterministic: the
same sources produce byte-identical CSS, independent of thread scheduling or file
order.

## What it deliberately does not do

- It does not generate CSS in the browser.
- It does not read class names to decide what wins; it has a stated ladder.
- It does not style markup it cannot see. If a component from a package renders
  the element, you style it from the outside, with a
  [contextual selector](/docs/styling/contextual) or by passing compiled props.

Next: [the mental model](/docs/start/mental-model), five ideas that follow from
this design, and make everything else predictable.
