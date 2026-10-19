# Dense names

## Summary

With `names: "dense"`, a production build through the Vite or Rolldown host gives the condition and
value hashes in every class name codes of one or two characters. The codes are assigned from the
whole build:

- `k50-KFHz_D9ur` becomes `k50-b_a`;
- the property code and the target segment stay, so the runtime merges exactly as before and no
  table ships;
- only names the compiler wrote are renamed.

It is opt-in (D-084).

## Context <!-- requirements and decisions implemented: KRN-CMP-006, D-037, D-084 -->

[class-names.md](class-names.md) measured the floor: sequential names would cut the three apps' CSS
by about a quarter in gzip. It ruled them out for two reasons:

- **at transform time**, a name that depends on what else compiled breaks incremental builds;
- **an opaque name** loses the conflict key the runtime reads.

Dense names avoid both:

- **renaming happens after the whole build is known**, when chunks render, so transforms and the dev
  server keep D-037's names;
- **only the two hash segments are replaced**, so the key keeps its structure.

## Design

- **`kirana_ir::dense`** holds the map and the tokenizer.
  - It recognises every form a name takes: atom, entry tombstone, property tombstone, unfold, and
    bridged variable.
  - Segments are read by length: 3 is a target, 4 a hash, and 1–2 an assigned code.
- **Condition codes** skip length 3, so the runtime can still tell a target from a condition.
  `scoped()` in `npm/core/src/internal.ts` now accepts a condition segment of any length but 3. The
  runtime is 1,087 of its 1,100 bytes.
- **Value codes are one space shared by every key, not one per key.** An unfold builds a longhand's
  name at runtime from the shorthand atom's value segment (D-045). Per-key codes would let the same
  code mean two values under one longhand key.
- **Codes are assigned in order of use.** `Project::assign_dense` counts every op of every handle
  across modules, plus the unfold siblings the stylesheet adds. Ties go in hash order. A code, once
  given, never changes for the session; later segments are appended. This is why the client build
  and the SSR build, which share one Driver session in Vite, agree.
- **Capacity.** At 62 + 62² codes per kind, the map stops. A segment without a code keeps its hash,
  which is longer than any code, so a miss costs bytes, never a wrong merge.
- **Marks.** A dense build turns on `Project::mark_dense` at `buildStart`.
  - From then on the transform writes `^~` before every name it puts into code (`Names::written`).
  - `renderChunk` renames only marked names and removes every mark, with magic-string so source maps
    hold (`Driver.dense`).
  - Text that only looks like a name stays exactly as written: a documentation page quoting
    `k50-KFHz_D9ur`, or a user's string.
- **The stylesheet** is the compiler's alone and is renamed unmarked, when it is filled
  (`stylesheet(true, dense)`). Its rules keep their order: the ladder's last tie-break uses the hashed
  name, and renaming happens after the stylesheet is written.
- **Not with a class map.** The server-template helpers (D-069) carry their own copy of the merge
  rules and read hashed names, so a dense build with `classes` configured fails at `buildStart`.

## Rejected

- **Renaming every name-shaped string.** The first version did this. On this repository's docs site
  it renamed the playground's example output, `.ka_Elck` to `.ka_12`, and with it the documented
  naming scheme. Marks fixed it: 60 pages, identical text.
- **A map from whole names.** It needs every tombstone and unfold token ever written, which the
  registry does not keep. A segment map covers all of them by construction.
- **Frequency per output file.** The client and the server would disagree.

## Measured

**The lab's `apps/web` (Kirana 0.2.2 build, simulated with `kirana-spec/research/scripts/structured-names.mjs`):**

- CSS: −19.5 % gzip, −20.3 % brotli;
- JS: −2.0 % gzip.

**This repository's docs site, built both ways with this code:**

| Asset                                          | Gzip    | Brotli  |
| ---------------------------------------------- | ------- | ------- |
| The Kirana stylesheet                          | −12.7 % | −12.9 % |
| All client CSS (with globals and highlighting) | −9.0 %  | −9.0 %  |
| All client JavaScript                          | −1.2 %  | −1.4 %  |

- **Build:** 3.72 s → 3.89 s, two builds each.
- **Correctness:** both builds served with `wrangler dev`, 41 routes in light and dark, every computed
  property of every element and its `::before` and `::after` (143,706 per run). There were
  73 differences, all from scripted animation. The hashed build compared with itself gave 71 and 74.
  The visible text of all 60 linked pages was identical.

## Tests

- `kirana_ir::dense` unit tests: every form, what is not a name, code order, marks, capacity.
- **Merge vectors.** `fixtures/merge/dense-vectors.json` holds the 400 merge vectors renamed by the
  Rust map, and `npm/core/test/merge-vectors.test.ts` replays them through the runtime. With the old
  `scoped()`, 97 fail.
- `kirana_project/tests/project.rs`:
  - a dense build's modules and stylesheet agree;
  - an unmarked lookalike string is kept;
  - codes survive a later module.
- **`npm/rolldown/test/rolldown.test.ts`:**
  - no hash left anywhere;
  - the same rules in the same order;
  - every atom a chunk names has its rule;
  - a chunk with no names passes through;
  - a class map is refused.
- `npm/vite/test/vite.test.ts`: a client build and an SSR build with one plugin give identical names,
  all in the client's stylesheet.

## Related

[class-names.md](class-names.md), [runtime-merge.md](runtime-merge.md), [shorthand-atoms.md](shorthand-atoms.md).
