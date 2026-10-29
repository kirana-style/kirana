# Diagnostics reference
Source: https://kirana.style/docs/tooling/diagnostics

# Diagnostics reference

Every diagnostic has a stable code and a kebab-case name. Neither changes meaning
once released, so you can suppress or raise one by name and trust it to keep
meaning the same thing.

A diagnostic about one property points at that property (`width: 5` in
`css({ display: "grid", width: 5 })`), not at the whole `css()` call, even when
the style object is declared in one place and passed to `css()` somewhere else in
the same module. The [editor](/docs/tooling/editor) underlines exactly that
property, and the [lint plugin](/docs/tooling/lint) reports it there.

The table below is generated from the compiler's own catalogue at build time, so
it cannot drift from what the compiler actually emits.

<!-- ::diagnostics -->

## Severities

- **error**: the output would be wrong. The build fails, and the level cannot be
  changed.
- **warning**: the output is valid but probably not what you meant.
- **info**: something worth knowing: a runtime bridge, a lowered target.

Any non-error can be re-levelled, including to `"off"`, in
[`diagnostics`](/docs/reference/config).

## The ones you will actually meet

**`sx-on-external-component`**: you gave `sx` to a component that does not read
it. Spread compiled props instead:
[styling other people's components](/docs/styling/external-components).

**`unused-sx`**: a component takes `sx` and never applies it, so callers think
they can style it and cannot.

**`ambiguous-precedence`**: two values could both apply and the ladder cannot
order them. Nest one condition inside the other, or declare the pair exclusive:
[precedence](/docs/styling/precedence).

**`mixed-logical-physical`**: a box has both logical and physical longhands set,
in a way whose outcome could mislead. Pick one axis family. It also covers an
inline logical inset beside a translate that moves along x: translates have no
logical form, so the element is off centre in right-to-left text. Use a physical
inset with the translate.

**`unreachable-entry`**: an info. A condition key nested in another that it can
never meet, such as `'[data-side="top"]': { '[data-side="bottom"]': … }`. Nothing
under it can apply, so it is left out of the stylesheet. Two libraries' states the
configuration declares apart with `exclusiveAcross` are left out the same way, but
quietly: nesting them is how a style is written once for every library.

**`select-state-on-parent`**: an info. A pseudo-class nested under a `select`
target, `[select.child("a")]: { color: { ":hover": … } }`, is the state of the
element carrying the style. For the link's own hover, write it into the target:
`[select.child("a:hover")]`.

**`unsplittable-shorthand`**: a shorthand whose value cannot be split into
longhands exactly, usually `border: var(--something)`. It stays whole, which means
a later style cannot remove just one of its longhands.

**`dynamic-bridged`** (info): a value became a custom property because it is only
known at runtime: [values known at runtime](/docs/styling/dynamic).

**`relation-without-anchor`**: a style reads a relation whose anchor is never
applied, so it can never match: [relations](/docs/styling/relations). A build
checks the relations whose module it compiled; `kirana-style check` checks them all.

**`relation-read-on-anchor`**: an info. An element carries a relation's anchor
and reads a state through it, `<form sx={[form.anchor, card]}>` with
`form.within('[data-disabled="true"]')` in its style. The read matches only inside
another form, never on this one, so the card does not change when the form is
disabled. For the element's own state, use the state as the condition key:
`'[data-disabled="true"]': 0.55`.

**`invalid-fallback`**, **`invalid-position-try`**, **`invalid-view-transition`**
and **`invalid-counter-style`** report a value the browser would drop or misread:

| Diagnostic                | What it catches                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `invalid-fallback`        | A [`firstThatWorks()`](/docs/styling/fallbacks) run whose values set different longhands            |
| `invalid-position-try`    | A property a [`positionTry()`](/docs/styling/anchor-positioning) block ignores                      |
| `invalid-view-transition` | A [`viewTransition()`](/docs/styling/view-transitions) part that is not one of the four             |
| `invalid-counter-style`   | A [`counterStyle()`](/docs/styling/at-rules#counter-styles) descriptor or system that draws nothing |

**`unresolved-import`**: an import a style depends on could not be resolved, so
its value compiles as a runtime value. Check the specifier and your tsconfig
paths. An import no style reads, such as a string from a Vite virtual module
passed as a prop, is a runtime value already and is not reported.

**`import-cycle`**: a value a style reads comes through an import cycle, and the
message names it (`core/states.ts → core/kirana.ts → core/states.ts`). The module
that closes the cycle reads the other one before it has been evaluated, so the
value compiles as a runtime value. Move what both modules need into a module of
its own that neither imports back. A type-only import (`import type`,
`import { type … }`) holds no value and never makes a cycle.

## Reading one

```console
$ kirana-style check src
error[KRN1301] unknown-condition: ":hover" is a condition, and conditions nest
inside property values (src/card.tsx:12:3)
  help: write `property: { [condition]: value }`
```

Code, name, message, location, and a help line that says what to do. `kirana-style check
--format json` gives the same fields as data.

<!-- ::diagnostics-figure -->
