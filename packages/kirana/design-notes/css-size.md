# CSS size against StyleX

> **Outcome (2026-09-21):** a second round — rule merging, selector folding and shorter definition
> names — is measured in [Round two](#round-two-2026-09-21) at the end of this note, together with
> the cost of the wider value segment that E-04 settled.
>
> **Outcome (2026-09-15):** option 1 is implemented as shorthand atoms (D-045, [shorthand-atoms.md](shorthand-atoms.md))
> together with option 2. The stylesheet is now 15.36 kB gzip and the client JavaScript 274.38 kB; see
> [benchmark-results.md](benchmark-results.md). The measurements below are the investigation that led there,
> with the class names of that time.

## Summary

The demo's Kirana stylesheet is 84.1 kB raw and 18.0 kB gzip, against 62.7 kB and 16.8 kB for the StyleX
port's atoms. Nearly all of the raw gap and most of the gzip gap is **longhand expansion**: 434 extra rules,
mostly four-side box properties. Kirana's class names, which look longer, are a gzip _advantage_. Counting
JavaScript, the Kirana build already ships 2.6 kB gzip less than the StyleX build.

## Context <!-- requirements and decisions implemented: KRN-PERF-003, KRN-CAS-001, D-011, D-037, D-042, D-044; experiment E-04 -->

KRN-PERF-003 asks for CSS no larger (gzip) than the StyleX port's. The advisory benchmark reported
19.9 kB against 17.8 kB. This note measures where the bytes go, compares the design with StyleX
(its Babel plugin) and the StyleX SWC port
(`stylex-swc-plugin`), and ranks the remedies.

## Measurements

Both apps built with `vite build` from the same demo; sizes are `gzip -9` of the client assets; rules were
parsed from the minified CSS.

| Asset                                               | Raw      | Gzip     |
| --------------------------------------------------- | -------- | -------- |
| Kirana `stylesheet.css` (tokens, themes, atoms)     | 84.1 kB  | 18.0 kB  |
| Kirana `globals.css` (separate file)                | 6.2 kB   | 1.9 kB   |
| StyleX atoms (its single CSS file minus reset/base) | 62.7 kB  | 16.8 kB  |
| StyleX single CSS file (atoms + reset + base)       | 65.5 kB  | 17.6 kB  |
| Client JavaScript, Kirana                           | 869.8 kB | 276.5 kB |
| Client JavaScript, StyleX                           | 870.4 kB | 281.4 kB |

The advisory benchmark's 19.9 kB adds the separately gzipped globals file; bundled into one file the two
Kirana files would be 19.7 kB. The CSS + JavaScript total is 296.4 kB gzip for Kirana against 299.0 kB for
StyleX: StyleX carries its merge keys in JavaScript (`{ $$css: true, padding: "x1qpkjjb" }`), Kirana in the
class names.

| Composition                   | Kirana             | StyleX            |
| ----------------------------- | ------------------ | ----------------- |
| Rules                         | 1,499              | 1,065             |
| Selector bytes                | 37.5 kB            | 27.8 kB           |
| of which `:where(…)`          | 20.9 kB            | 6.4 kB            |
| Declaration bytes             | 42.8 kB            | 31.0 kB           |
| Average first class name      | 10.4 characters    | 8.6 characters    |
| At-rule headers               | 14 (rules grouped) | 38 (one per rule) |
| Token declarations on `:root` | 5.7 kB             | 6.1 kB            |

Each remedy applied to the real Kirana output, measured separately:

| Remedy                                                                  | Raw      | Gzip        |
| ----------------------------------------------------------------------- | -------- | ----------- |
| Minify values and selectors (`.5`, `a,b`, `[data-x=y]`, `width>=40rem`) | −1.4 kB  | −0.15 kB    |
| Drop `:where()` around a single simple condition                        | −2.5 kB  | −0.08 kB    |
| StyleX-style random 8-character class names                             | −2.1 kB  | **+2.1 kB** |
| Fold four-side longhand groups back into one shorthand rule (97 groups) | −14.2 kB | **−2.0 kB** |

With minification and folding the stylesheet would be 66.1 kB raw and 15.7 kB gzip, below StyleX's atoms.

## Why

- **Longhand expansion (D-011).** `padding: spacing[4]` is four rules in Kirana and one in StyleX. StyleX's
  default `styleResolution: "property-specificity"` keeps shorthands as written and makes longhands win by
  priority (SWC port: `get_default_priority` gives shorthands-of-shorthands 1000, shorthands-of-longhands
  2000, logical longhands 3000, physical longhands 4000). Its `"application-order"` mode keeps the shorthand
  too and emits `null` resets of the longhands into the merge table. Only `"legacy-expand-shorthands"`
  expands, as Kirana does.
- **Names.** Kirana's names share structure: the property code, one condition hash per condition set and one
  value hash per value repeat across many rules (`k3T-KFHz_0yl`, `k2J-KFHz_MO8`), and gzip finds them. StyleX
  hashes each atom into seven unrelated characters. Shortening Kirana's names would cost bytes.
- **`:where()`.** Kirana wraps every condition so every rule has specificity (0,1,0) and source order is the
  ladder (D-036); StyleX uses priority layers and `.x.x` doubling instead. The raw cost is real, the gzip cost
  is 80 bytes, and removing it would need specificity padding for at-rule conditions.
- **Minification.** The writer (D-044) prints values as authored. StyleX's output goes through Lightning CSS
  minification, which Kirana avoids because it rewrites colours.
- **Separate globals file.** An application choice: StyleX's plugin injects its CSS into `globals.css`;
  Kirana serves its own stylesheet asset.

## Design options for E-04

1. **Shorthand atoms (recommended).** Keep a single-component box shorthand (`padding`, `margin`, `inset`,
   `gap`, `border-radius`, `border-width|style|color`, `scroll-margin`, `scroll-padding` and their
   block/inline forms) as one atom whose merge entry _covers_ its longhand keys:
   - a later longhand replaces its own key and emits a longhand atom; the shorthand atom stays and loses to
     it in CSS through ladder step 5, which already ranks the declaration that set fewer longhands higher
     (D-042);
   - a later shorthand of the same family replaces every covered key, as expansion does;
   - removing one covered key (`paddingTop: null`) re-expands the shorthand into the remaining longhands at
     build time. The private runtime cannot expand, so it needs the covered-key list: either a family code
     in the class name (`k7V…` family digits) or a table of the dozen families in the runtime (about 150 B
     gzip against the 1.0 kB budget).
   - Semantics stay the merge table's; the merge vectors (`fixtures/merge/vectors.json`) gain shorthand
     operations so the Rust and runtime merges keep proving equivalence.
   - Expected: −14 kB raw, −2.0 kB gzip on the demo, and three class names fewer per box declaration in
     the JavaScript.
2. **Writer minification.** Leading zeros, spaces after commas and around `*` and `/` (never `+` or `-`, which `calc()` needs), unquoted
   attribute values that are identifiers, media range syntax. Never colours. Expected −0.15 kB gzip.
3. **One stylesheet file.** Let the adapter prepend plain CSS imported through
   `@kirana-style/core/stylesheet.css` (or document `@import` of `globals.css` into it) so apps ship one asset.
   Expected −0.14 kB gzip.
4. **Not recommended:** StyleX-style random class names (+2.1 kB gzip); dropping `:where()` (−0.08 kB gzip for
   a specificity scheme with more cases).

## Consequences

Option 1 changes D-011's output packaging, not its merge semantics — exactly the room D-011 left for E-04 —
and needs a decision, fixtures for every covered family, and merge-vector coverage. Options 2 and 3 are
implementation-only.

## Round two (2026-09-21)

Measured on the whole corpus — `apps/web`, `apps/blocks` and `apps/examples` — rather than the demo
alone, each figure being that build's client CSS raw, its CSS at `gzip -9`, and its client JavaScript
at `gzip -9`.

| Stylesheet                                               | CSS raw  | CSS gzip | JS gzip    |
| -------------------------------------------------------- | -------- | -------- | ---------- |
| Before                                                   | 252.6 kB | 60.8 kB  | —          |
| Merged rules, folded selectors, 4-character names        | 245.0 kB | 60.1 kB  | 1,541.4 kB |
| **Shipped** (the above, with the 4-character value hash) | 249.2 kB | 61.7 kB  | 1,549.3 kB |

Three changes, each measured on its own:

- **Merging rules that repeat a declaration** (`write_block` in `kirana_emit`). In a stylesheet of
  atoms the same declaration recurs under many condition sets: a selector list costs one comma where
  a second rule costs its whole body. Two rules merge only when no rule between them decides the same
  property — a logical longhand counts as its physical counterpart, and a shorthand blocks every
  merge across it, because moving a rule past a competing declaration would change which one wins.
- **Folding the compound into the relation's `:where()`.** `:where(:hover):where(.m *)` and
  `:where(.m *:hover)` match the same elements at the same specificity; the second is eight bytes
  shorter, on every rule that has both a state and a relation.
- **Definition names at four characters** (`NAME_HASH`). Relation markers, theme classes, keyframes
  and `--kv` variables repeat throughout the output; the registry now reports a collision between two
  definitions the way it reports one between two atoms, so the shorter name is still checked.

Together: −7.6 kB raw and −0.7 kB gzip. The fourth character of the value hash then costs 4.1 kB raw,
1.7 kB CSS gzip and 8.0 kB JavaScript gzip, and is paid deliberately — see
[class-names.md](class-names.md#why-the-value-segment-is-four-characters).

**Raw CSS still trails StyleX** (249.2 kB against 228.6 kB) and closing that gap is not an
optimization away. The remaining raw bytes are class names (18–19 % of the file) and duplicated
declaration bodies that cannot be merged without moving a rule past a competing one. Shortening names
further costs gzip, as the table above shows and as the 2026-09-15 measurement showed before it:
StyleX's random eight-character names cost 2.1 kB gzip when tried here. Kirana wins the measurement
that reaches the browser — CSS gzip, and CSS plus JavaScript gzip — and states the raw number rather
than hiding it.

## Round three (2026-09-21): is the model itself right?

Round two tuned the output. This round asked the harder question — whether atoms, self-describing
names and `:where()` are the right method at all, or only the method we happened to build. Six
alternatives were applied to the built corpus and measured; none of them is an improvement, and the
reasons are worth keeping.

| Method                                                    | Result                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| StyleX's naming: eight opaque characters per atom         | **Worse.** +5.4 kB CSS gzip, +10.6 kB JS gzip: unrelated names do not compress.            |
| Shortest safe opaque name (`k` + 5)                       | −11.7 kB gzip, then **−77 kB raw of name-to-key table** to keep runtime merging. Net loss. |
| Sequential names (`k0`, `k1`, …), the floor               | −57.9 kB gzip, and order-dependent: D-024, breaks incremental builds and the dev server.   |
| Composed classes for everything (the CSS-Modules model)   | −67.6 kB gzip, **+216 kB raw CSS**, and runtime merging cannot work at all.                |
| Composed classes where the compiler already resolves them | **+33 kB raw CSS** for −1.4 kB total gzip: the atoms cannot be freed, so it only adds.     |
| A sublayer per ladder step instead of `:where()`          | **Worse.** 348–409 sublayers cost more than the 4.7 kB of wrappers they replace.           |
| Dropping `:where()` where the ladder already agrees       | −1.8 kB raw per app, gzip unchanged. Real, small, and the only one that survives.          |

The composed-class result is the interesting one, because it is the model most of the ecosystem
uses. It fails here for a specific reason: every component in this design system takes `sx` and
merges it with its own styles, so the final class list is only known at render time. The compiler
resolves 33 of 519 lists in `apps/web`, 268 of 955 in `apps/blocks`, 191 of 867 in `apps/examples` —
and composing only those frees 165–264 atoms of 1,135–1,537, leaving nearly the whole atom layer in
place with the composed rules stacked on top of it.

### Where the raw-CSS gap against StyleX actually is

`apps/examples`, 90.5 kB against 82.1 kB:

| Component           | Kirana    | StyleX    | Difference |
| ------------------- | --------- | --------- | ---------- |
| `:where()` wrappers | 587 × 8 B | 169 × 8 B | +3.3 kB    |
| Declarations        | 1,668     | 1,534     | +3.5 kB    |
| Everything else     | —         | —         | +1.6 kB    |

Both of the large ones are the price of a stated semantic, not an unoptimised path. The wrappers are
what make every rule (0,1,0), so that source order alone is the precedence ladder and a reader's own
class always wins — StyleX buys the same thing in part with `.x.x` doubling (67 rules here) and in
part by not offering the guarantee. The declarations are longhand expansion, which is what makes
merging per entry: a later style replaces the entries it names. Shorthand atoms (D-045) already took
this as far as it goes — the two builds now emit the same number of `padding`, `gap`, `inset` and
`border-radius` shorthands.

So raw CSS is the one column of the benchmark this design gives away, and it gives it away on
purpose. It is also the one column that never reaches a person: CSS is served compressed, and
compressed is where the structured names win.

## Related

`spec/08-conditions-and-cascade.md#longhand-expansion`, [runtime-merge.md](runtime-merge.md),
[class-names.md](class-names.md), `bench/slice.ts`.
