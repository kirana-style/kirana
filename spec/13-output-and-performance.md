# 13 — Output and Performance

**Owns:** the output contract (artifacts, minification, browser targets, determinism, dead-style
elimination), performance targets expressed as hypotheses, and engineering rules for performance work.
**Depends on:** [00-glossary](./00-glossary.md), [20-decisions](./20-decisions.md) (D-020, D-026,
D-036, D-037, D-039, D-044), [08-conditions-and-cascade](./08-conditions-and-cascade.md), [10-compiler-architecture](./10-compiler-architecture.md),
[14-benchmark-methodology](./14-benchmark-methodology.md).

## Artifacts

| Artifact               | When                                 | Contents                                                                                                       |
| ---------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Transformed modules    | every build                          | Class strings, class expressions, bridged `style` objects, `@kirana-style/core/internal` imports, source maps. |
| Stylesheet             | every build                          | One CSS file per application build: layer order statement, tokens, themes, contextual styles, atoms.           |
| Stylesheet source map  | development; production when enabled | Maps each atom rule to the source spans that produced it.                                                      |
| `kirana.manifest.json` | `kirana build --library` only        | Library atoms, tokens, relations and exports ([11](./11-integrations.md#monorepos-and-published-libraries)).   |
| Name map               | development only                     | Class name → source spans, for the language server and future devtools.                                        |

## Output requirements

**KRN-OUT-001 — Minified by default.** Production builds MUST emit minified CSS without any configuration
in Kirana or the host (D-026). The engine's own writer minifies (D-044). Development output is unminified.

**KRN-OUT-002 — Explicit targets.** Output MUST be lowered for the configured browser targets only. The
default floor is Chrome 123, Safari 17.5, Firefox 120 — the floor at which `light-dark()`, `oklch()`,
`color-mix()`, cascade layers, `:has()` and range media queries are emitted as written. When configured
targets require lowering, the engine lowers through Lightning CSS and reports each lowered feature once
with `target-lowering`. Colour functions and colour spaces are never rewritten unless a target lacks
support for them.

**KRN-OUT-003 — One layer order statement.** The stylesheet MUST begin with the complete layer order
declared in [08](./08-conditions-and-cascade.md#layer-plan), so every rule's position is fixed before
any rule appears, regardless of how hosts split or concatenate CSS.

**KRN-OUT-004 — Names.** Class and variable names MUST contain no file paths, component names or other
source text, in development as in production (D-037). Formats are owned by
[10](./10-compiler-architecture.md#hashing-and-names).

**KRN-OUT-005 — Atomic recipes.** Recipes MUST compile to atoms shared with every other style; there is
no per-recipe class output (D-020).

**KRN-OUT-006 — Determinism.** For identical sources, configuration, lockfile and compiler version, the
stylesheet, class names and transformed modules MUST be byte-identical across operating systems,
architectures, thread counts and repeated runs.

**KRN-OUT-007 — Dev and production share order.** Development output MUST use the same layer plan, class
names and atom order as production; the only differences are source maps and minification (D-037).

**KRN-OUT-009 — One rule per declaration body.** The writer MAY give one rule the selectors of
several atoms that carry the same declaration, and MUST do so only when no rule between them decides
the same property: the same longhand, its logical or physical counterpart, or any shorthand, which
covers longhands the writer does not enumerate. A merge that could reorder two competing declarations
is forbidden, because within a layer source order is the ladder (D-036). The writer MAY likewise fold
a rule's condition compound into a relation's `:where()` when the two match the same elements at the
same specificity.

**KRN-OUT-008 — Dead-style elimination.** The stylesheet MUST contain only atoms referenced by modules
that are part of the host's build graph (or the CLI's included files). Tokens, keyframes and relations
that no emitted atom references MUST NOT be emitted.

### Class and variable names

Summary of [10](./10-compiler-architecture.md#hashing-and-names): classes look like `k50-KFHz_D9ur`
(prefix, property code, condition hash, 4-character value hash); definition names — relation markers,
theme classes, keyframes and variable tokens — are the prefix, a kind letter and 4 characters
(`--kvD9ur`); bridged values use `--k` plus the conflict key. Development builds use the same names;
`kirana trace` explains them.

The value hash is four characters because three is not enough for the values one property carries in
a real application: measured over the shadcn/ui port's three applications, three left a 1.5–3.1 % chance
per build that two values would name one atom, which is `class-name-collision` and no output at all.
The evidence, the alternatives and the byte cost are in
`packages/kirana/design-notes/class-names.md`.

## Performance targets

Every target below is a **HYPOTHESIS** until the named experiment reports on the corpus and method in
[14-benchmark-methodology](./14-benchmark-methodology.md). Targets are stated relative to the baseline in
the measured baseline so they stay valid as hardware changes.

| ID               | Target                                                                                                                                                               | Experiment |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **KRN-PERF-001** | Production build of the shadcn/ui port's apps with Kirana is faster than the StyleX port and within 25 % of the Tailwind twin.                                       | E-02       |
| **KRN-PERF-002** | The prefilter rejects at least 80 % of transformed modules in the shadcn/ui port's apps without parsing them.                                                        | E-02       |
| **KRN-PERF-003** | CSS for the ported slice is no larger (gzip) than the StyleX port's CSS for the same UI, with longhand expansion's merge semantics.                                  | E-01, E-04 |
| **KRN-PERF-004** | After a single-file style edit in development, the updated stylesheet is available within 50 ms (p95).                                                               | E-02       |
| **KRN-PERF-005** | Peak engine memory while building all three apps stays below 200 MB.                                                                                                 | E-02       |
| **KRN-PERF-006** | On the large-DOM benchmark, Kirana's style recalculation per interaction is at parity with the StyleX port's, and a whole-page restyle is within 15 % of it (D-048). | E-07       |

Advisory measurements for the slice, including KRN-PERF-003 (17.22 kB against 17.61 kB gzip after D-045),
are kept in `packages/kirana/design-notes/benchmark-results.md`. KRN-PERF-006 is measured by the runtime benchmark
(`bench/runtime.ts` in the benchmark repository, E-07): the same route in all three builds, grown to six thousand
elements, driven through each build's own colour-scheme switch and through hovers with the CPU
throttled, reading style recalculation and frame times from the renderer itself.

The private runtime size limit (1.0 kB min+gzip) is a requirement, not a hypothesis, and is owned by
[09](./09-dynamic-styles.md#private-runtime) as KRN-DYN-005.

## Engineering rules

These rules guide implementation; changing a default requires benchmark data recorded next to the code.

1. **Measure before optimizing.** Performance-sensitive choices carry a `// PERF:` comment stating the
   measured reason; reviewers who want to change one bring data (convention adopted from Panda v2's
   `PERF(port)` markers — ).
2. **One parse per module**, one arena per module, released after IR construction; no AST crosses a crate
   boundary into caches.
3. **Non-cryptographic hash maps** (for example `rustc-hash`) for all internal maps; inputs are not
   adversarial.
4. **Write-once data is immutable and compact:** boxed strings for atom text, small inline vectors for
   condition sets.
5. **One native boundary crossing per module transform**, returning compact results; no JSON
   serialization on hot paths, no per-module JavaScript callbacks.
6. **Batch APIs for cold builds** so parallel extraction is not throttled by per-call overhead.
7. **The stylesheet is written once per change**, not per module, and Lightning CSS runs only when targets
   require lowering ([10](./10-compiler-architecture.md#css-emission)).
8. **Instrumentation:** `tracing` spans around every pipeline stage, exportable as a Chrome trace from
   `kirana build --trace`, and disabled at zero cost in release builds unless requested.
