# Benchmark results

Advisory numbers under the claims policy of
[14-benchmark-methodology](../../../spec/14-benchmark-methodology.md): one developer machine,
not a dedicated benchmark host. They exist so each change can be compared with the last; they are not
published claims.

The harness that produces them, the benchmarks and the conformance crawler, runs in a separate repository beside the StyleX port and the Tailwind original; the commands below are run there.

**Machine:** Linux (WSL2), 12 cores, 31 GB. **Tools:** Bun 1.4.2, Node.js 24.21.0, Vite 8.
**Date:** 2026-09-15.

## Output and build changes (sprint 3, 2026-09-21)

Same machine, same three applications, measured before and after the output changes of S3-CSS-01 and
S3-CSS-02. CSS is every client `.css` asset at `gzip -9`; JS is every client `.js` asset the same way.

| Corpus                                                       | CSS raw  | CSS gzip | Client JS gzip |
| ------------------------------------------------------------ | -------- | -------- | -------------- |
| Before                                                       | 252.6 kB | 60.8 kB  | —              |
| Merged rules, folded selectors, 4-character definition names | 245.0 kB | 60.1 kB  | 1,541.4 kB     |
| **Shipped** (the above, with the 4-character value hash)     | 249.2 kB | 61.7 kB  | 1,549.3 kB     |

Against StyleX's 228.6 kB raw, 63.0 kB CSS gzip and 1,596.0 kB JavaScript gzip: raw CSS still trails
by 20.6 kB, CSS gzip wins by 1.3 kB, and CSS + JavaScript wins by 47.9 kB. The fourth character of the
value hash is bought deliberately — it takes the chance of a build failing on a hash collision from
1.5–3.1 % to 0.02–0.05 % — and both notes state the trade:
[`design-notes/css-size.md`](../design-notes/css-size.md#round-two-2026-09-21) and
[`design-notes/class-names.md`](../design-notes/class-names.md#why-the-value-segment-is-four-characters).

Build-system measurements from the same round:

| Measure                                                           | Before  | After   |
| ----------------------------------------------------------------- | ------- | ------- |
| `turbo run typecheck --force` (7 packages)                        | 1.95 s  | 1.64 s  |
| `bun run build`, nothing changed since the last run               | 26.5 s  | 1.7 s   |
| `kirana-style build` over `packages/ui` and the three apps' `src` | —       | 0.05 s  |
| Peak engine memory over that build (KRN-PERF-005, ≤ 200 MB)       | —       | 44 MB   |
| Stylesheet pushes, 8 cold routes requested at once (dev)          | 16      | 6       |
| Edit to updated stylesheet, median (KRN-PERF-004)                 | 46.6 ms | 36.8 ms |

KRN-PERF-004 asks for the updated stylesheet within 50 ms of an edit (p95). Measured end to end —
write the file, then poll the dev server's stylesheet from a second process while a browser holds
the page open — the median is 36.8 ms, with outliers in the high 50s. The floor, with the
compiler's own scheduling removed entirely, is 39.3 ms median: nearly the whole budget is Vite's
watcher, the re-transform and the browser round trip. The scheduler now adds nothing to an edit that
follows a quiet moment, because those are sent at once, and only coalesces while transforms keep
arriving.

The warm build was never cached before because the native engine's task inputs used an explicit
`crates/**` glob, which does not consult `.gitignore`: the `.profraw` files a coverage run leaves
behind changed its hash, so every build rebuilt the engine and every app.

## Work is proportional to styling (E-02) — 2026-09-22

The claim behind the prefilter is that a styling system should cost what the styling costs, not what
the dependency graph costs. Counted at the adapter boundary, on a production build of `apps/web`:

| Measure                                            | Value                          | Requirement                 |
| -------------------------------------------------- | ------------------------------ | --------------------------- |
| Modules the build transformed                      | 7,747                          | —                           |
| Of those, carrying styles                          | 56 (0.7 %)                     | —                           |
| **Rejected by the prefilter without being parsed** | **99.3 %**                     | KRN-PERF-002: ≥ 80 % ✓      |
| Corpus build, three apps                           | 16.2 s against StyleX's 43.6 s | KRN-PERF-001: faster ✓      |
| Engine share of it (`packages/ui` + three apps)    | 0.05 s over 370 modules        | —                           |
| Peak engine memory over the same build             | 44 MB                          | KRN-PERF-005: < 200 MB ✓    |
| Edit to updated stylesheet in the browser, median  | 36.8 ms                        | KRN-PERF-004: < 50 ms p95 ✓ |

`kirana-style check <paths> --stats` prints the engine's own view of the same thing — modules seen,
rejected, parsed, and parsed again to read another module's imports — so the number can be taken
again on any tree rather than trusted from here.

The engine-side share looks very different on a styling-dense tree, and should: over
`packages/ui/src` and `apps/web/src` the prefilter rejects 15.1 % of 106 modules, because nearly
every file there carries styles. That is the same claim seen from the other end — the work follows
the styling.

## Runtime (E-07, KRN-PERF-006) — 2026-09-21

`apps/web` at `/`, grown to about 6,200 elements, five interleaved rounds per build, the CPU
throttled. Style recalculation and layout are the renderer's own numbers through the DevTools
protocol; the frame figure is p95 over forty frames of the same colour-scheme switch. Method and
options in [`README.md`](README.md).

### CPU throttling 4×

| Implementation | Style recalculation | Recalculations | Layout  | Frame p95 |
| -------------- | ------------------- | -------------- | ------- | --------- |
| **Kirana**     | 1,262.9 ms          | 29             | 12.1 ms | 155.4 ms  |
| StyleX         | 1,156.0 ms          | 29             | 11.6 ms | 148.5 ms  |
| Tailwind       | 4,663.6 ms          | 52             | 12.3 ms | 939.6 ms  |

### CPU throttling 6×

| Implementation | Style recalculation | Recalculations | Layout  | Frame p95  |
| -------------- | ------------------- | -------------- | ------- | ---------- |
| **Kirana**     | 2,261.1 ms          | 30             | 19.7 ms | 264.5 ms   |
| StyleX         | 2,031.5 ms          | 29             | 17.2 ms | 241.9 ms   |
| Tailwind       | 7,034.5 ms          | 52             | 19.0 ms | 1,537.7 ms |

**Against Tailwind:** 3.1–3.7× less style recalculation and a sixth of the frame p95. Tailwind also
needs 52 recalculations where the other two need 29: its dark mode is a `.dark` class that
invalidates in more places.

**Against StyleX: at parity per interaction, 9–11 % behind on a whole-page restyle.** This run is
what D-048 was written from. Kirana spends 9.2 % more on style recalculation at
4× and 11.3 % more at 6×, with frame p95 4.6 % and 9.3 % higher. That gap holds its size across two
throttling rates and five interleaved rounds, so it is not noise — but it is one operation. Switching
colour scheme, which a person does about once a session, is 848 ms of the measurement; the
interaction path is 6 ms and level with the port.

### Chasing it

**It is not `:where()`.** The built stylesheet was patched with the safe unwrapping from
`design-notes/css-size.md` — 217 of 496 wrappers removed, the rest kept where the ladder and
specificity can disagree — and the benchmark re-run. Absolute times are not comparable between runs
(the machine was quieter for the second), so the number to read is the within-run ratio against
StyleX, which each run measures under its own conditions:

| Stylesheet           | 4× ratio | 6× ratio |
| -------------------- | -------- | -------- |
| As shipped           | 1.09     | 1.11     |
| `:where()` unwrapped | 1.18     | 1.19     |

Removing the wrappers did not help and may have hurt. Blink handles `:where()` well, and the
selectors it leaves behind are not cheaper to match. That closes the first hypothesis and removes the
runtime argument for an optimization that was already marginal on size.

**It is not the colour-mode mechanism either.** Both stylesheets use `light-dark()` exactly 49 times
and both carry one `prefers-color-scheme` block: the StyleX port inherited the same design, so there
is nothing to choose between them there.

**It is rule count, and the operation matters.** The first version of this benchmark folded a
colour-scheme switch together with hovers into one number. Split apart, five interleaved rounds:

| 4× throttling | Colour scheme | Recalcs | Hover   | Recalcs | Frame p95 |
| ------------- | ------------- | ------- | ------- | ------- | --------- |
| **Kirana**    | 848.6 ms      | 10      | 6.0 ms  | 19      | 110.8 ms  |
| StyleX        | 804.4 ms      | 10      | 4.6 ms  | 19      | 108.0 ms  |
| Tailwind      | 3,304.5 ms    | 11      | 22.3 ms | 39      | 748.0 ms  |

| 6× throttling | Colour scheme | Recalcs | Hover   | Recalcs | Frame p95  |
| ------------- | ------------- | ------- | ------- | ------- | ---------- |
| **Kirana**    | 1,405.0 ms    | 12      | 7.0 ms  | 19      | 169.1 ms   |
| StyleX        | 1,268.9 ms    | 11      | 6.9 ms  | 19      | 152.6 ms   |
| Tailwind      | 5,351.6 ms    | 12      | 34.3 ms | 39      | 1,186.9 ms |

Nearly all of the time is the colour-scheme switch — 848 ms against 6 ms for the hovers — and that is
where the whole difference lives. **Per interaction the three are not close to each other in the way
the totals suggested:** a hover costs 6.0 ms against StyleX's 4.6 ms at 4× and 7.0 ms against 6.9 ms
at 6×, on a deliberately throttled CPU and a page of 6,200 elements, while Tailwind pays 22–34 ms and
needs 39 recalculations where both of the others need 19.

Measured on the same page, the mechanism is plain:

| Build    | Classes per element | Class characters per element | Rules in the document |
| -------- | ------------------- | ---------------------------- | --------------------- |
| Kirana   | 13.48               | 137.7                        | 1,164                 |
| StyleX   | 13.27               | 109.5                        | 1,057                 |
| Tailwind | 12.66               | 248.5                        | 1,461                 |

Class lists are the same length (+1.6 %). The document carries **10.1 % more rules**, and style
recalculation is 5.5 % to 10.7 % more expensive. Those two numbers are the same number.

So the runtime gap and the raw-CSS gap are one finding, not two: longhand expansion produces more
rules, and more rules cost both bytes and matching time. That is what buys merging per entry — a
later style replaces the entries it names — and it is the same trade recorded in
`design-notes/css-size.md`, now measured a second way.

## Full three-way corpus (sprint 2)

`apps/web`, `apps/blocks` and `apps/examples`, each built three ways: with Kirana, as the StyleX port,
and as the Tailwind original: the same pages in all three, and every one of
them passes conformance (`conformance/README.md`). Median of 5 interleaved `vite build` runs;
`bun run kirana:bench kirana=$PWD stylex=<stylex-port> tailwind=<tailwind-original> --apps web,blocks,examples --rounds 5`.

| App      | Implementation | Build  | CSS raw  | CSS gzip | Client JS gzip | CSS + JS gzip |
| -------- | -------------- | ------ | -------- | -------- | -------------- | ------------- |
| web      | **Kirana**     | 1.43 s | 73.2 kB  | 17.6 kB  | 275.6 kB       | 293.2 kB      |
| web      | StyleX         | 3.26 s | 65.5 kB  | 17.8 kB  | 282.5 kB       | 300.3 kB      |
| web      | Tailwind       | 1.56 s | 184.2 kB | 26.9 kB  | 280.0 kB       | 306.9 kB      |
| blocks   | **Kirana**     | 2.18 s | 87.3 kB  | 21.2 kB  | 639.0 kB       | 660.2 kB      |
| blocks   | StyleX         | 7.46 s | 81.0 kB  | 22.2 kB  | 663.4 kB       | 685.6 kB      |
| blocks   | Tailwind       | 1.97 s | 204.0 kB | 30.4 kB  | 646.1 kB       | 676.6 kB      |
| examples | **Kirana**     | 1.94 s | 91.4 kB  | 22.1 kB  | 625.6 kB       | 647.7 kB      |
| examples | StyleX         | 5.51 s | 82.1 kB  | 22.9 kB  | 650.2 kB       | 673.1 kB      |
| examples | Tailwind       | 1.86 s | 198.4 kB | 29.7 kB  | 625.9 kB       | 655.7 kB      |

**Corpus total:**

| Implementation | Build   | CSS raw  | CSS gzip | Client JS gzip | CSS + JS gzip |
| -------------- | ------- | -------- | -------- | -------------- | ------------- |
| **Kirana**     | 5.55 s  | 251.9 kB | 60.9 kB  | 1,540.2 kB     | 1,601.1 kB    |
| StyleX         | 16.23 s | 228.6 kB | 63.0 kB  | 1,596.0 kB     | 1,659.0 kB    |
| Tailwind       | 5.39 s  | 586.5 kB | 87.1 kB  | 1,552.1 kB     | 1,639.1 kB    |

- **Against StyleX:** 2.9× faster builds; 2.1 kB less CSS gzip and 55.8 kB less JavaScript gzip, 57.9 kB less
  in total. Raw CSS is 23.3 kB larger; gzipped, it is smaller.
- **Against Tailwind:** builds within 3 % (Tailwind is faster on blocks and examples, slower on the
  demo); 26.2 kB less CSS gzip, 11.9 kB less JavaScript gzip, 38.0 kB less in total.
- **The demo** grew by 0.3 kB CSS gzip against the table below: the component warning fixes add the
  nested entries that state which condition wins (toast, drawer, input group, field, avatar, item).
- The benchmark measures production builds of whole apps: Vite, Rolldown and TanStack Start are most of
  the time; Kirana's engine is about 1 % of it (see Engine below).

## Demo build: Kirana, StyleX and Tailwind (sprint 1)

Before blocks and examples returned.

| Implementation                          | Build (median) | CSS raw     | CSS gzip     | Client JS gzip | CSS + JS gzip | CSS rules |
| --------------------------------------- | -------------- | ----------- | ------------ | -------------- | ------------- | --------- |
| Kirana before shorthand atoms           | 1.60 s         | 90.4 kB     | 19.86 kB     | 276.54 kB      | 296.39 kB     | 1,499     |
| **Kirana with shorthand atoms (D-045)** | **1.60 s**     | **70.7 kB** | **17.22 kB** | **274.38 kB**  | **291.60 kB** | **1,172** |
| StyleX port                             | 3.42 s         | 65.5 kB     | 17.61 kB     | 281.38 kB      | 299.00 kB     | 1,065     |
| Tailwind original                       | 1.68 s         | 184.2 kB    | 26.86 kB     | 278.88 kB      | 305.74 kB     | —         |

- **CSS** is every `.css` asset the client loads, each gzipped separately (`gzip -9`). Kirana serves two
  files: its stylesheet (64.4 kB raw, 15.36 kB gzip) and the app's `globals.css` (6.2 kB, 1.86 kB). The
  StyleX build bundles its reset into one file.
- **Client JS** is every `.js` asset; it includes the class strings, where Kirana carries its merge keys and
  StyleX carries style objects.
- **Build** is the median of 5 interleaved `vite build` runs (`bun run kirana:bench`), which for Kirana
  includes the engine.
- **CSS rules** counts style rules in the minified stylesheet.

Kirana against StyleX: 2.1× faster build, 0.39 kB gzip less CSS, 7.00 kB gzip less JavaScript, 7.40 kB
gzip less in total. Against its own previous build: 2.64 kB less CSS, 2.16 kB less JavaScript.

## What each step contributed

Measured on the same demo build, in the order the work landed:

| Step                                                              | Stylesheet gzip | Client JS gzip | CSS + JS gzip |
| ----------------------------------------------------------------- | --------------- | -------------- | ------------- |
| Longhand expansion (before)                                       | 18.00 kB        | 276.54 kB      | 296.39 kB     |
| Shorthand atoms with explicit tombstones and unfolds              | 15.57 kB        | 277.43 kB      | 294.86 kB     |
| + family-first property codes (no tombstones) and breadth ranking | 15.47 kB        | 274.38 kB      | 291.71 kB     |
| + minified writer output                                          | 15.36 kB        | 274.38 kB      | 291.60 kB     |

The first step alone made the JavaScript 0.89 kB larger: every shorthand carried a tombstone per longhand,
and every `borderColor`/`borderWidth`/`borderStyle` write carried four unfold tokens. The second step
removed both costs.

## Engine

| Measure                                                    | Value                             |
| ---------------------------------------------------------- | --------------------------------- |
| `kirana-style build packages/ui/src apps/web/src --minify` | 0.02 s, 20 MB peak memory         |
| Modules in that build                                      | 83                                |
| Private runtime, minified and gzipped                      | 995 B (budget 1,000 B; was 685 B) |

The engine is about 1 % of the application build; the rest is Vite, Rolldown and TanStack Start.

## Correctness at the same commit

| Check                                                                  | Result                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Computed styles at rest, 3 widths × 2 schemes, against the StyleX port | 0 differences                                             |
| Same against the Tailwind original                                     | 96, all listed in `conformance/expected-differences.json` |
| 15 interactive states × 2 schemes against the StyleX port              | 0 differences                                             |
| Rust tests / TypeScript tests                                          | 84 / 443 passed                                           |
| Line coverage, Rust and TypeScript                                     | 100 % / 100 %                                             |

## Reproducing

The baseline checkouts and servers are set up as in the root README (Comparing with the baselines).

```bash
# needs: bun run kirana:build here, bun install in each baseline
bun run kirana:bench kirana=$PWD/apps/web stylex=<stylex-port>/apps/web \
  tailwind=<tailwind-original>/apps/web --rounds 5
# needs: the three builds served on 3000 / 3301 / 3302
bun run kirana:conformance
bun conformance/compare.ts --actual http://localhost:3000 --expected http://localhost:3301 --label stylex --states
```

The benchmark reports client CSS and JavaScript (every `.css` and `.js` under `dist/client`, `gzip -9` per
file); CI runs it with all three implementations and writes the table to the job summary. Rule counts were
parsed from the minified CSS with a short script.

## E-06 language server (2026-10-02)

61 component files open, 300 hovers over 4587 targets, 60 edits; indexing 166.0 ms. Hover p50 0.3 ms, p95 1.2 ms (budget 50 ms); diagnostics after an edit p50 4.6 ms, p95 7.1 ms (budget 200 ms); memory 64 MB indexed, 65 MB at the end (budget 300 MB). All budgets met.
