# Shorthand atoms

## Summary

A shorthand declaration stays **one atom** (`padding: 1rem` is one rule, not four) while merging stays
exactly what longhand expansion gave: per longhand, per condition set, in author order, with `null`
removals. The CSS for the demo fell from 18.0 to 15.4 kB gzip, the client JavaScript from 276.5 to
274.4 kB gzip, and every computed style still matches the StyleX port at rest and in 15 interactive
states. The measurements are in [benchmark-results.md](benchmark-results.md).

## Context <!-- requirements and decisions implemented: D-045 (amends D-011's output packaging, D-037's property codes, D-042's step 5), KRN-CAS-001, KRN-CAS-003, KRN-CAS-004, KRN-DYN-005, KRN-PERF-003, KRN-TEST-003; experiment E-04 -->

D-011 expanded every shorthand into longhands so merging could work per longhand. That was correct and
expensive: 1,499 rules against StyleX's 1,065, and a 2.0 kB gzip gap measured in
[css-size.md](css-size.md). D-011 left E-04 room to change the output packaging but not the merge
semantics, and that is the constraint this design keeps.

## The method

### 1. Which declarations become shorthand atoms

| Declaration                                                                                                                                                  | Result                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| A **box family** shorthand with one component (`padding: 1rem`, `gap: space[2]`, `borderColor: theme.border`, a single-component `var()` of a project token) | one shorthand atom                                            |
| A shorthand whose value cannot be typed (`border: var(--line)`, `overscroll-behavior: contain none`)                                                         | one shorthand atom, with the `unsplittable-shorthand` warning |
| A runtime value of any shorthand (`inset: offset` where `offset` is a prop)                                                                                  | one bridged shorthand atom                                    |
| A typed multi-component value (`padding: "1px 2px"`, `border: "1px solid red"`)                                                                              | longhands, as before                                          |

The 31 box families (`padding`, `margin`, `inset`, `gap`, `overflow`, `border-radius`,
`border-width|style|color`, `place-*`, `overscroll-behavior`, `scroll-margin|padding` and every
block/inline form) are the shorthands whose single component is copied to each longhand, so an atom and
its expansion are the same CSS.

### 2. Breadth: how atoms rank

Ladder step 5 already said "the declaration that set fewer longhands wins" (D-042). An atom's
**breadth** is its number of longhands, so any longhand beats `padding` (4), `border-width` (4) beats
`border` (12). One refinement: a **secondary** shorthand — outside the families but sharing only some
longhands with one (`border-top` with `border-width`) — ranks one above the largest family it overlaps
(`border-top` is 5, still below `border`). That decides which of two partially overlapping shorthands
carries the merge instructions below: the rare secondary write, never the common family write.

### 3. Writing a property

Every write is compiled into ordinary merge operations, so the compiler's merge and the private runtime
stay one algorithm:

1. **Unfold** every shorthand atom that overlaps the written property only partly and is no broader than
   the write (for a removal: every overlapping atom), **narrowest first**.
2. **Remove** every shorthand the property fully covers (a tombstone per key).
3. For a non-family atom, **remove its longhands** (tombstones). A family atom needs none: see §5.
4. **Set** the atom (or the longhands of an expansion, or remove them for `null`).

A longhand written after an atom simply beats it at step 5 and needs nothing. A family atom written after
longhands replaces them.

### 4. Unfold

`Unfold { shorthand, keep, target, conditions | every }` replaces each earlier atom of `shorthand` in
scope by atoms of the longhands in `keep`, with the atom's own value and breadth. A kept longhand that
already has a **set** entry is skipped: it was written after the atom, because every earlier entry was
cleared by the atom (§3.3/§5), and every later removal unfolds the atom first, so a tombstone found there
is the atom's own. Unfolding narrowest first keeps this rule true when several atoms overlap: two
overlapping atoms can only coexist if the narrower one was written later.

The unfolded longhands reuse the atom's value segment (`k0_V2H` → `k1_V2H`, `k2_V2H`, …), so the runtime
names them without knowing the value. Their rules are emitted only when some module in the build contains
an unfold of that shorthand on that target; otherwise no bytes are spent.

### 5. Class names that carry the family

The generated property table puts the 9 four-longhand families first, each shorthand followed by its
longhands, then the 22 two-longhand families in blocks of three, then every other property in order.
Property codes are base-62 indices (D-037), so `padding` is `0` and its longhands `1`–`4`; `gap` is `J`,
`row-gap` `K`, `column-gap` `L`. The runtime needs two constants (`FOUR = 45`, `TWO = 111`) and index
arithmetic to find a family's longhands — no table, no tombstones in class strings. The most used
properties also got one-character codes.

### 6. What travels in class strings

| Token               | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `k0_V2H`            | the `padding` atom; its code removes keys `1`–`4` (same target and conditions) |
| `kh_ ki_ … k4f_iOv` | a non-family atom (`border`) after explicit tombstones for its longhands       |
| `k0/1.2.3*_`        | unfold `padding` at every condition set, keeping longhands `1`, `2`, `3`       |
| `kJ/K-KFHz_`        | unfold `gap` under `:hover` only, keeping `row-gap`                            |

Tombstones and unfold tokens never reach the DOM.

## Provenance

| Idea                                                          | Source                                                                                                                                                                                                                                                                                                                                      | Kirana's form                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Keep shorthands as one rule; longhands outrank shorthands     | **Mirrored.** StyleX `styleResolution: "property-specificity"` (`@stylexjs/babel-plugin/src/shared/preprocess-rules/property-specificity.js`; SWC port `stylex-css/src/css/common.rs` `get_default_priority`: 1000/2000/3000/4000); Panda v2 `crates/pandacss_stylesheet/src/sort.rs` (shorthands before logical before physical longhands) | Ladder step 5 by breadth (D-042), inside Kirana's single ordered layer                         |
| A shorthand clears its longhands when merged                  | **Mirrored.** StyleX `"application-order"` (`preprocess-rules/application-order.js` emits `[longhand, null]` pairs into the compiled object)                                                                                                                                                                                                | Tombstones in the class string (non-family atoms) or implicit removal from the code (families) |
| Exactness for later removals of one side                      | **New.** Neither StyleX mode keeps a side removed after a shorthand (`property-specificity` keeps the shorthand; `application-order` has nothing left to unfold)                                                                                                                                                                            | The unfold operation, its ownership rule and narrowest-first order                             |
| Longhand codes derived from the shorthand code                | **New**, building on Kirana's own index codes (D-037)                                                                                                                                                                                                                                                                                       | Family-first property table; runtime index arithmetic                                          |
| Breadth for secondary shorthands                              | **New**; modifies the StyleX/Panda priority classes, which rank by shorthand kind rather than by what overlaps                                                                                                                                                                                                                              | `breadth()` in `kirana_cascade`                                                                |
| Longhand rules only where an unfold can need them             | **New**; the same principle as dead-style elimination (KRN-OUT-008)                                                                                                                                                                                                                                                                         | `Project::live` in `kirana_project/src/registry.rs`                                            |
| Minified writer output (`.5`, `a,b`, `[x=y]`, `width>=40rem`) | **Mirrored in effect** from CSS minifiers (StyleX's output passes through Lightning CSS); Kirana's writer does it without touching colours (D-044)                                                                                                                                                                                          | `kirana_emit/src/minify.rs`                                                                    |

## Where the code is

| Part                                | Location                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Family-first property table         | `scripts/gen-css-data.ts` → `crates/kirana_css_data/src/generated.rs`, `npm/core/src/families.generated.ts`                   |
| Family lookup                       | `kirana_css_data::family_longhands`, `property_index`                                                                         |
| Atom decision, write plans, breadth | `kirana_cascade`: `declare_with`, `longhands_of`, `write_plan`, `prepare_set`, `removal`, `breadth`, `mixed_logical_physical` |
| Merge operations                    | `kirana_ir/src/style.rs`: `Op::Unfold`, `Handle::apply`, `Names::class`                                                       |
| Writes, nulls, `"*"`, bridges       | `kirana_evaluator/src/style.rs`: `property`, `bridge`                                                                         |
| Stylesheet and trace                | `kirana_project/src/registry.rs` (`live`, `ModuleRecord::unfolds`), `kirana_project/src/trace.rs`                             |
| Private runtime                     | `npm/core/src/internal.ts` (`add`: family removal, unfold, `code`, `scoped`)                                                  |
| Minification                        | `kirana_emit/src/minify.rs`                                                                                                   |

## How it is proven

| Test                                                                           | What it checks                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kirana_cascade` `shorthand_atoms_merge_like_expanded_longhands` (proptest)    | For random sequences of sets and removals over 24 properties (box families, border families, `border`, side shorthands, with and without `:hover`), every longhand resolves to the value the author's intent gives it. 20,000 cases pass. |
| `kirana_ir` `merge_is_associative`, `merging_twice_changes_nothing` (proptest) | Merging stays associative and idempotent as class sets with unfolds and family atoms.                                                                                                                                                     |
| `fixtures/merge/vectors.json` + `npm/core/test/merge-vectors.test.ts`          | 400 seeded merge sequences give the same classes in Rust and in the private runtime.                                                                                                                                                      |
| `kirana_cascade` `box_families_match_the_typed_longhands`                      | The property table's families equal Lightning CSS's longhands (it found `overscroll-behavior`, which Lightning CSS does not split).                                                                                                       |
| `fixtures/transform/shorthand-atoms`                                           | Atoms, overrides, removals, secondary shorthands, bridges and `"*"` end to end.                                                                                                                                                           |
| `conformance/compare.ts` at rest and with `--states`                           | 0 computed-style differences against the StyleX port at 3 widths × 2 schemes, and in 15 interactive states × 2 schemes.                                                                                                                   |
| `npm/core/test/internal.test.ts`                                               | The runtime stays within 1.0 kB gzip (995 B).                                                                                                                                                                                             |

The property tests found three real bugs during development: an unfold overwrote a longhand written
after the atom, the atom's own tombstones were mistaken for later writes, and a broad atom unfolded before
a narrower one lost the narrower value. Each is a rule in §4.

## Limits

- An unfold copies the atom's value to the longhands it keeps. That is exact for family atoms with one
  component, and wrong for an atom whose value has several components (`border: var(--line)` holding
  `1px solid red`) when a later style removes one of its longhands. `unsplittable-shorthand` warns at the
  declaration.
- Classes of a merged handle can be listed in a different order than the writes were made; the class set
  and the CSS are the same.
- The private runtime is at 995 of its 1,000 bytes. Any further runtime feature needs bytes found
  elsewhere first.

## Room for improvement

Measured on the demo, what is left is small:

| Remaining lever                                     | Expected gain          | Status                                                           |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Serving `globals.css` inside the Kirana stylesheet  | ~0.14 kB gzip          | An application choice; not a compiler change                     |
| Dropping `:where()` around single simple conditions | ~0.08 kB gzip          | Not worth a specificity scheme with more cases                   |
| StyleX-style random class names                     | +2.1 kB gzip (worse)   | Rejected: Kirana's structured names compress better              |
| Engine build time                                   | 20 ms of a 1.6 s build | No meaningful room: the rest is Vite, Rolldown and the framework |

**Marked: for this design, output size and build time have no significant room left.** A further step
would need a different model — for example, one class per recurring _combination_ of atoms — which
conflicts with per-longhand merging and with D-020's rejection of grouped classes, so it is not pursued.

## Related

[css-size.md](css-size.md), [class-names.md](class-names.md), [runtime-merge.md](runtime-merge.md),
`spec/08-conditions-and-cascade.md#longhand-expansion`, `spec/20-decisions.md` (D-045).
