# Runtime merge

## Summary

`@kirana-style/core/internal` merges compiled handles in the browser with exactly the build-time merge
semantics, in under 1 kB gzip, using nothing but the class names.

## Context <!-- requirements and decisions implemented: KRN-DYN-002, KRN-DYN-003, KRN-DYN-005, KRN-API-014, KRN-TEST-003, D-018, D-043 -->

Handles cross component boundaries at runtime (`sx` props, recipe calls with runtime options,
conditional handles). The merge must not ship per-handle metadata and must agree with
`kirana_ir::Handle::merge` byte for byte.

## Design

- A handle is a class string, or `{ c, v }` when it carries bridged variables. `runtime(prefix)`
  returns `cx`, `sx`, `b` and `recipe` bound to the build's prefix.
- `add` walks tokens into a `Map` keyed by the conflict key (`token.slice(prefix.length,
  lastIndexOf("_"))`): delete then set, so the last writer moves to the end, as `Handle::apply`
  retains then pushes. Foreign classes are keyed by `" " + token` and keep their first position.
- A `…*_` tombstone deletes the property's element key (`50`) and its condition keys (`50-XXXX`, one
  dash and four characters), but not another target's keys (`50-abc…`) or their tombstones
  (`50-abc*`, also five characters longer — found by the merge vectors).
- A box-family atom (`k0_…`, `padding`) also deletes its longhand keys (`1`–`4`, same target and
  conditions): the runtime decodes the base-62 code and applies the table's layout, `FOUR`/`TWO` from
  `families.generated.ts`. A `{shorthand}/{codes}{scope}_` token unfolds earlier atoms of that shorthand into
  the kept longhands that have no later set, reusing the atom's value segment (D-045,
  [shorthand-atoms.md](shorthand-atoms.md)).
- `sx(handles, classNames, styles)` merges foreign class names first, strips tombstones, and merges
  style objects with bridged variables last, which is how a host element keeps a library's
  `className`/`style`.
- `recipe(table)` merges base, the chosen option per group and every matching compound entry, per
  slot. No mixed-radix table: output grows with the number of options, not their product.

## Alternatives considered

- **A precomputed variant table** (the original D-020): faster lookups, but exponential output; E-05
  may bring it back where it measures faster.
- **Shipping conflict metadata per handle**: larger, and a second source of truth.

## Consequences

- Equivalence is tested, not assumed: `crates/kirana_ir/tests/properties.rs` generates 400 seeded
  merge sequences into `fixtures/merge/vectors.json`, and `npm/core/test/merge-vectors.test.ts`
  replays them through the runtime.
- The size budget is asserted in `npm/core/test/internal.test.ts` (minified with Oxc and gzipped; 995 of 1,000 bytes after D-045).

## Related

[class-names.md](class-names.md), `spec/09-dynamic-styles.md#private-runtime`.

## The byte budget (2026-09-21)

KRN-DYN-005 caps the private runtime at 1,000 bytes minified and gzipped, and
`npm/core/test/internal.test.ts` fails the build above it. It is at **999**, so the honest summary
is that there is one byte left and the next feature has to pay for itself. `bun run budget` prints
where the bytes are; each part is removed on its own and the module re-minified, so the figures
include whatever else the minifier can then drop and do not add up to the whole.

**Update (2026-09-23).** The Preact and Solid modes needed `sx()` to answer with `class`. Taking the
attribute from the compiler, `runtime(prefix, attribute)`, paid for itself: a default parameter cost
7 bytes and went over, while dropping the default removed the runtime's only `"className"` literal and
left it at **997**. The table below is from the 999-byte version:

| Part           | Cost  | What it is                                                                    |
| -------------- | ----- | ----------------------------------------------------------------------------- |
| the merge core | 528 B | `add`: parsing a class name, replacing by conflict key, tombstones, unfolding |
| `cx` and `sx`  | 715 B | the two entry points, and the merge core they keep alive                      |
| `recipe()`     | 147 B | variants, compound variants and slots, resolved at render time                |
| the bridge `b` | 23 B  | one custom property for a value known only at render time                     |

**Where the next 147 bytes come from.** `recipe()` is the only part that is not needed by every
module that needs any of it: a recipe whose options are known compiles away entirely, and the
runtime one is for the dynamic case the `dynamic-variant` diagnostic names. It costs 147 B — 15 % of
the budget — in every module that gets the runtime at all, because `runtime(prefix)` returns one
object and a minifier cannot drop a property of it. Splitting the factory so that a module imports
only the entry points it uses would give that back, at the cost of the adapter choosing between
them. That is the first thing to do when a feature needs room, and it is not worth doing before.

**Measure with Node.** Bun's zlib reports 1,003 B for the same bytes. The test uses Node's, so the
budget is Node's; a Bun measurement looks like a failure that is not one.
