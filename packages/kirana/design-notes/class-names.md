# Class names

## Summary

Every atom's class name is `{prefix}{property code}[-{target 3}][-{conditions 4}]_{value 4}`, fixed
width, identical in development and production. The part before the last `_` is the atom's conflict
key, which is all the runtime needs to merge handles.

## Context <!-- requirements and decisions implemented: KRN-CMP-006, KRN-OUT-004, KRN-OUT-006, D-037 -->

The specification first lengthened a colliding segment. That made a name depend on which modules had
compiled, so a module emitted before the collision disagreed with one emitted after it, and a
long-lived dev server could not stay deterministic.

## Design

- `kirana_ir::style::Names` builds every name: `class(op)`, `bridge_variable(key)`,
  `named(kind, parts)` for relations (`kr`), themes (`kt`), keyframes (`kf`) and variable tokens
  (`--kv`), and `mode_marker(mode)` (`km-light`).
- The property code is `base62_compact` of the longhand's index in `kirana_css_data::PROPERTIES`,
  generated from `mdn-data`. The 31 box families come first, each shorthand followed by its longhands,
  so a family atom's code locates its longhands (D-045, [shorthand-atoms.md](shorthand-atoms.md)); the
  rest follow in name order. `padding` is `k0`, `padding-top` `k4`, `color` `k50`.
  Custom properties use a 5-character XXH3 hash, which cannot collide with a 1–3 character index.
- The target segment (3) hashes the pseudo-element or contextual selector text; the conditions
  segment (4) hashes `ConditionSet::canonical()`, whose conditions are sorted and deduplicated. The
  value segment (4) hashes the normalized CSS text, plus the longhand count when a shorthand set more
  than one longhand, because ladder step 5 ranks those atoms differently. Four characters, not three:
  see [Why the value segment is four characters](#why-the-value-segment-is-four-characters).
- Definition names — relation markers, theme classes, keyframes and variable tokens — carry
  `kirana_ir::NAME_HASH` characters (4). Anything that reads a name back out of CSS text counts those
  characters (`deps_in`), which is why the width is a constant rather than a literal at each site.
- Tombstones: `…_` removes one key and `…*_` every key of a property on a target. They travel inside
  class strings between handles and are stripped from DOM `className`s (`dom_class_string`).
- `kirana_project::registry` checks every class and conflict-key segment after each update. Two atoms
  with one name is the `class-name-collision` error; `debug_force_collision` lets a test prove the
  check runs.

## Alternatives considered

- **Lengthening on collision** (the original D-024): order-dependent, rejected.
- **Readable development names** (`k-inline-size-md_50`): a second naming scheme doubles the merge
  runtime's cases and hides dev/prod differences. `kirana-style trace` gives readability instead.
- **Hash-only property segments**: 4–5 characters for every atom; the index keeps the common case to
  two.

## Consequences

- The property table order is part of the output. Regenerating `generated.rs` from a new `mdn-data`
  changes class names, which is acceptable at a compiler version bump and checked in CI.
- A truncated hash can still collide; it fails loudly rather than corrupting output. At four
  characters (about 24 bits) that is 0.02–0.05 % per build of an application the size of this
  repository's, and it grows with the square of the number of atoms one property carries.
- The value segment costs a byte per atom in the stylesheet and in every bundle that names the class:
  measured over the three applications, the fourth character is 4.1 kB of raw CSS, 1.7 kB of CSS gzip
  and 8.0 kB of JavaScript gzip. That is the price of the paragraph below.

## Why the value segment is four characters

D-037 fixed the widths and left the value segment at three characters, to be revisited with data from
the full applications rather than guessed (Q-01). This is that data.

### Three characters collides on ordinary values

Three base-62 characters is 238,328 names. These two colours — both plausible in one palette, both
plausible on `color` — take the same one:

```
oklch(21% 0.12 250)   ->  _bUU
oklch(27% 0.21 250)   ->  _bUU
```

At four characters they are `_ObUU` and `_ibUU`. The pair is pinned by
`the_value_segment_is_wide_enough_for_real_values` in `crates/kirana_ir/tests/style.rs`, so the
evidence is executable and not a claim in a document.

It takes no unusual value to find one. A search over ordinary design-system values — a rem and pixel
scale, percentages and an `oklch` ramp — produces a colliding pair within the first few thousand.

### How likely it is in a real project

Collisions matter per conflict key: two values only compete for a name when they are set on the same
property, target and condition set. Counting the distinct values of every conflict key in the three
applications, as built:

| Application     | Atoms | Competing pairs | 3 characters | 4 characters |
| --------------- | ----- | --------------- | ------------ | ------------ |
| `apps/web`      | 1,192 | 3,637           | 1.5 %        | 0.02 %       |
| `apps/blocks`   | 1,530 | 5,537           | 2.3 %        | 0.04 %       |
| `apps/examples` | 1,603 | 7,414           | 3.1 %        | 0.05 %       |

Read that as: at three characters, about one application in forty the size of `apps/examples` cannot
be built at all, and the number rises with the square of the project's atoms. It is not rare enough
to ship.

### What happens when it collides

`kirana_project::registry` catches it and fails the build with `class-name-collision` (KRN1903) and
the help text "report this: two atoms hashed to the same name; the build cannot be trusted". There is
no flag, no workaround and nothing to fix in the source except to change one of the two values — for
a mistake the author did not make. Nothing is silently wrong; the build simply stops.

### Why widening is the fix, and the only one

- **Lengthening the colliding segment on demand** is D-024, rejected in the Context above and again
  here: the name would depend on what else the project contains, so a module compiled before the
  collision would disagree with one compiled after it. Correct output would depend on compile order.
- **A wider alphabet** does not help: adding `-` and `_` to base 62 gains 10 %, against the 62× a
  character buys.
- **Hashing the value with its conflict key** changes which names appear, not how many fit in three
  characters. The birthday arithmetic inside one key is unchanged.
- **Failing softer** is not available: two atoms with one name is two styles with one meaning.

So the width is the whole lever, and the question is only where to set it. Three characters costs a
build in forty. Five costs another byte everywhere for a risk already below one in a thousand.

## What another naming scheme would cost

The structured name looks long — `k50-KFHz_D9ur` against StyleX's `x1a2b3c4d` — and nobody reads
either of them, so the question is fair: why not the shorter one? Measured on the built corpus by
rewriting the names in the real CSS and JavaScript assets and compressing the result
(`gzip -9`, `apps/web` + `apps/blocks` + `apps/examples`):

| Scheme                                    | CSS raw  | CSS gzip | JS gzip    | CSS + JS gzip |
| ----------------------------------------- | -------- | -------- | ---------- | ------------- |
| **Today** `k50-KFHz_D9ur`                 | 249.2 kB | 62.0 kB  | 1,545.3 kB | 1,607.3 kB    |
| Value hash 3 `k50-KFHz_9ur`               | 245.0 kB | 60.6 kB  | 1,537.6 kB | 1,598.2 kB    |
| No separators `k50KFHzD9ur`               | 243.1 kB | 61.0 kB  | 1,539.0 kB | 1,600.1 kB    |
| StyleX's scheme, opaque 8 `x1a2b3c4d`     | 241.9 kB | 67.4 kB  | 1,555.9 kB | 1,623.3 kB    |
| Opaque 6 `k` + 5 (the shortest safe hash) | 229.0 kB | 60.2 kB  | 1,535.4 kB | 1,595.6 kB    |
| Sequential `k0`, `k1`, `k2` (the floor)   | 209.5 kB | 46.6 kB  | 1,502.8 kB | 1,549.4 kB    |
| _StyleX, for reference_                   | 228.6 kB | 63.0 kB  | 1,596.0 kB | 1,659.0 kB    |

Three things fall out of that table.

**StyleX's own scheme would make this output worse**, not better: eight unrelated characters per atom
cost 5.4 kB more CSS gzip and 10.6 kB more JavaScript gzip than the structured names, because the
structured ones repeat — one property code, one condition hash per condition set, one value hash per
value — and compression lives on repetition. The 2026-09-15 measurement of the demo alone found the
same thing (+2.1 kB gzip).

**An opaque name would have to carry its conflict key somewhere else.** Merging is per entry: a later
style replaces the entries it names, and the runtime that does this when a value is only known at
render time reads the key out of the class name. With opaque names it would need a table instead —
name to key, for every atom a runtime merge can reach. Counted in the built bundles: 1,029 such atoms
in `apps/web`, 1,208 in `apps/blocks`, 1,240 in `apps/examples`, about **77 kB raw of table** against
the 11.7 kB of gzip that opaque naming saves. The structured class name _is_ that table, folded into
a string the page already ships. StyleX pays the other way: its merge keys travel as
`{ $$css: true, color: "x1abc" }` objects in JavaScript, and its JavaScript is 50.7 kB gzip larger
here.

**The floor is real but unreachable.** Sequential names would win every column, including raw CSS
against StyleX. They are also a function of which module compiled first, which is D-024: a module
emitted before a new style disagrees with one emitted after it, so incremental builds and the dev
server cannot use them. Nothing in between recovers much: the separators are load-bearing (`_` is the
tombstone marker and `split("-")[0]` bounds a variable-width property code), and the condition hash
cannot drop to three characters either — measured, that is a 1.0–1.4 % chance per build of two
condition sets taking one key.

So the raw-CSS gap against StyleX is not an oversight and not one optimisation away. It is the price
of a self-describing name, and it buys back more than it costs everywhere the bytes actually reach a
browser.

## Related

`spec/10-compiler-architecture.md#hashing-and-names`, [runtime-merge.md](runtime-merge.md), and
[dense-names.md](dense-names.md), which renames the hashes after a production build instead.
