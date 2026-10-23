# 20 — Decision Log

**Owns:** every product and architecture decision, its rationale, and the document that elaborates it.
**Depends on:** [00-glossary](./00-glossary.md).

Other documents cite decisions by ID (`per D-014`) and never restate them as new decisions. A
decision changes only by editing this file: mark the old entry `Superseded by D-NNN` and add the new
one. Status values: **Accepted** (binding for the feasibility phase), **Provisional** (binding, but
reopened by a named experiment).

## Identity and licensing

### D-001 — Working name, domain and namespaces

- **Status:** Provisional — reopened by trademark clearance (the licensing notes).
- **Decision:** The product is **Kirana**, tagline **"Styling, compiled."** Canonical domain
  `kirana.style`. `kirana.build` and `kirana.tools` are defensive registrations only. npm scope
  `@kirana`, CLI binary `kirana`, Rust crates `kirana_*`, GitHub organisation `kirana`. The npm
  names and the binary are superseded by D-082: scope `@kirana-style`, command `kirana-style`.
- **Rationale:** `.style` states the category and separates the name from its Indian retail meaning.
- **Elaborated in:** the brand notes.

### D-002 — License

- **Status:** Accepted.
- **Decision:** All Kirana code, presets and documentation are released under the **MIT** license.
- **Rationale:** Matches StyleX, Panda, Tailwind and the StyleX SWC port, so permissive reuse with
  notices stays simple for users and contributors.
- **Elaborated in:** the licensing notes.

## Product shape

### D-003 — Independent API, migration by codemod

- **Status:** Accepted.
- **Decision:** Kirana has its own authoring API and semantics. It is not source-compatible with
  StyleX, Panda or Tailwind. Existing projects migrate through one-shot codemods
  (`kirana-style migrate stylex`, `kirana-style migrate tailwind`).
- **Rationale:** Compatibility would bind Kirana to another project's release cadence — the exact
  problem the community StyleX SWC port lives with — and would import the API frictions recorded in
  the StyleX comparison.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [12-tooling-and-dx](./12-tooling-and-dx.md).

### D-004 — Authoring surfaces

- **Status:** Accepted.
- **Decision:** v0.1 ships object styles (`css`) and recipes (`recipe`) as first-class surfaces. The
  utility surface is specified as reserved syntax and ships at milestone M5.
- **Rationale:** Both surfaces compile to one Style IR; proving the IR on objects first keeps the
  first milestones small without closing the door on Tailwind-style readability.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md).

### D-005 — Empty engine, optional presets

- **Status:** Accepted.
- **Decision:** The engine ships no tokens, scales, breakpoints or colours. Vocabulary arrives only
  from the user's definitions or opt-in presets. The first first-party preset is
  `@kirana-style/preset-scales`.
- **Rationale:** This repository proved that an unopinionated engine plus a Tailwind-derived
  vocabulary works; keeping vocabulary out of the engine keeps enterprise design systems first-class.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md).

### D-006 — Styles and tokens may live anywhere

- **Status:** Accepted.
- **Decision:** No special file extension. Tokens, relations, keyframes and styles may be declared in
  any module and imported with any import form (named, namespace, default re-export, barrel).
- **Rationale:** StyleX's `.stylex.ts` and named-import rules caused recurring build failures in this
  repo; a project-wide resolver removes the need for them.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [10-compiler-architecture](./10-compiler-architecture.md).

### D-007 — Types come from source, never from code generation

- **Status:** Accepted.
- **Decision:** TypeScript types for tokens, recipes and relations are inferred from their definitions.
  Kirana never generates a types directory. Tokens are referenced as imported values (`space[4]`), not
  string paths, in objects and recipes.
- **Rationale:** Generated type graphs were a documented editor-cost problem for Panda and a stated
  dislike of the founder; inference keeps types in lock-step with source at no build cost.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md).

### D-008 — Inline or variable is the compiler's choice

- **Status:** Superseded by D-035.
- **Decision:** There is one token API. The compiler inlines a token's literal value unless the token
  is themed, has modes, is overridden in a scope, or is declared `variable: true`, in which case it
  emits a CSS custom property.
- **Rationale:** StyleX forces authors to choose `defineConsts` or `defineVars` up front; the choice is
  derivable from usage.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md).

### D-009 — Modes use `light-dark()`

- **Status:** Accepted.
- **Decision:** Colour modes compile to `light-dark()` values selected by `color-scheme` on the root
  element. Non-colour per-mode values and custom themes compile to scoped variable overrides.
- **Rationale:** Proven in the StyleX comparison build: one value per token, derived tokens follow the
  mode automatically, and the root scheme also fixes scrollbars and iframe canvases.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md).

### D-010 — Tailwind-compatible data ships as a preset under a neutral name

- **Status:** Accepted.
- **Decision:** Scale data compatible with Tailwind CSS v4 (spacing, palette, type ramp, radii,
  shadows, breakpoints) ships as `@kirana-style/preset-scales`, with MIT attribution. No Kirana package name
  contains a competitor's mark.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md), the licensing notes.

## Semantics

### D-011 — Longhand expansion in the IR

- **Status:** Accepted for merge semantics; the output packaging is superseded by D-045 (E-04).
- **Decision:** Shorthands are expanded to longhands in the Style IR. Merging, deduplication and
  precedence operate on longhands only.
- **Rationale:** Removes the "shorthand loses to longhand regardless of order" class of bugs.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-012 — Every rule is layered

- **Status:** Accepted.
- **Decision:** Every rule Kirana emits, including custom-property assignments, lives inside a named
  cascade layer under the `kirana` root layer. Kirana emits no unlayered rules.
- **Rationale:** StyleX's unlayered lowest-priority group made plain custom-property defaults beat
  layered conditions.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-013 — Omitted keeps, `null` removes

- **Status:** Accepted.
- **Decision:** Inside a conditional value, an omitted `base` keeps the earlier merged value; `null`
  explicitly removes it.
- **Rationale:** The natural spelling does the natural thing; the destructive operation must be
  written on purpose.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-014 — One global precedence ladder

- **Status:** Provisional — reopened by experiment E-03 (cascade ladder).
- **Decision:** Atom precedence is decided by one documented, global ladder: more conditions beat
  fewer; at equal count, state conditions (pseudo-class, attribute, relation) beat at-rule conditions;
  at-rules order by query range; pseudo-classes order by a fixed table.
- **Rationale:** Atomic CSS cannot honour per-call-site source order; a global ladder that matches
  what Tailwind authors expect (state beats breakpoint) is predictable and explainable.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-015 — Relations are declared and validated

- **Status:** Accepted.
- **Decision:** Group/peer/has relationships are declared with `relation()`. The compiler validates,
  project-wide, that every relation read is applied somewhere and every applied relation is read, and
  that the anchor sits on the element the condition describes.
- **Rationale:** 36 silent no-op markers in the StyleX port; these checks lived in a hand-written
  script instead of the compiler.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-016 — Contextual styles lose to own styles

- **Status:** Accepted.
- **Decision:** Kirana supports ancestor-to-descendant styles for element-type and data-attribute
  selectors. They are emitted in a layer below every element's own styles, so a descendant's own style
  always wins.
- **Rationale:** Removes the context-variable workaround StyleX forced and the
  `:not([class*='size-'])` hacks Tailwind components used.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-017 — Dynamic values never inject CSS at runtime

- **Status:** Accepted.
- **Decision:** Values are classified static, finite dynamic, or open dynamic. Finite dynamic lowers to
  class expressions within a branch budget; open dynamic uses the CSS-variable bridge. Kirana never
  generates or injects CSS rules at runtime.
- **Elaborated in:** [09-dynamic-styles](./09-dynamic-styles.md).

### D-018 — Private runtime only

- **Status:** Accepted.
- **Decision:** The only runtime code is a class joiner and a variant lookup, imported from a private
  module the compiler controls. There is no public runtime styling API.
- **Elaborated in:** [09-dynamic-styles](./09-dynamic-styles.md).

### D-019 — `sx` is compiler-native

- **Status:** Accepted.
- **Decision:** `sx` is recognised in any style-bearing module without an import. On host elements it
  compiles to `class` and `style`; on components it passes through as a prop. Merge order is argument
  order.
- **Rationale:** StyleX compiled `sx` only in files importing `@stylexjs/stylex`, silently shipping
  uncompiled props elsewhere.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md).

### D-020 — Recipes compile to atoms

- **Status:** Accepted; the runtime variant table is superseded by D-043.
- **Decision:** Recipes always compile to atoms. Statically known variant selections resolve to a
  class string at build time; runtime selections use a precomputed variant table. There is no grouped
  per-variant class output, because grouped classes could not be merged per longhand with `sx`
  overrides.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [13-output-and-performance](./13-output-and-performance.md).

## Compiler

### D-021 — Rust engine on Oxc

- **Status:** Accepted.
- **Decision:** The engine is written in Rust. JavaScript/TypeScript parsing, semantic analysis, module
  resolution and source maps use Oxc crates. Babel and SWC are not used.
- **Rationale:** VoidZero-first toolchain (Oxc, Rolldown, Vite, Oxlint, Oxfmt); Panda v2 validates Oxc
  for this workload. Rust/Oxc is a baseline, not a differentiator (the landscape notes).
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md).

### D-022 — The compiler never executes user code

- **Status:** Accepted.
- **Decision:** Style values are computed by a restricted evaluator over a closed JavaScript subset and
  pure-function descriptors. Anything else is a diagnostic or goes through the dynamic path. The only
  user code Kirana runs is the configuration file, evaluated once by the JavaScript Driver, never by
  the engine.
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md).

### D-023 — Prefilter, then parse only style-bearing modules

- **Status:** Provisional — reopened by experiment E-02 (prefilter).
- **Decision:** Every module passes a byte-level prefilter; only possible style-bearing modules are
  parsed. A module crosses the native boundary at most once per transform.
- **Rationale:** `@stylexjs/unplugin` ran its transform 8,800 times in the StyleX port's build
  (the measured baseline).
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md).

### D-024 — Deterministic, path-independent class names

- **Status:** Superseded by D-037.
- **Decision:** A class name is a prefix (`k` by default, configurable), a conflict-key segment, `_`,
  and a value segment, each
  base-62 text taken from a 64-bit hash of the normalized atom's parts (target, longhand and condition
  set; value). A project-wide collision check lengthens segments deterministically. Hash inputs never
  include file paths.
- **Rationale:** Deterministic names across machines; the conflict-key segment lets the private runtime
  merge classes without shipping metadata ([09-dynamic-styles](./09-dynamic-styles.md#private-runtime)).
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md).

### D-025 — Own CSS writer, Lightning CSS as a dependency

- **Status:** Superseded by D-044.
- **Decision:** The engine writes CSS from the Style IR itself and uses Lightning CSS, unmodified, for
  target lowering and minification.
- **Rationale:** Reuses a mature CSS backend; Lightning CSS is MPL-2.0, so it is consumed only as a
  dependency (the licensing notes).
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md).

### D-026 — Minified by default, explicit targets

- **Status:** Accepted.
- **Decision:** Production output is minified without configuration. Browser targets are explicit with
  a default floor of Chrome 123, Safari 17.5, Firefox 120; the compiler lowers syntax only when targets
  require it and never changes colour spaces otherwise.
- **Rationale:** In this repo the CSS was unminified until Vite and the plugin were configured, and
  default targets rewrote `oklch()` to `lab()` and polyfilled `light-dark()`.
- **Elaborated in:** [13-output-and-performance](./13-output-and-performance.md).

### D-027 — Dev and production share cascade order

- **Status:** Superseded by D-037.
- **Decision:** Development output differs from production only in readable class names, source maps
  and minification. Layer order and precedence are identical.
- **Elaborated in:** [11-integrations](./11-integrations.md), [13-output-and-performance](./13-output-and-performance.md).

## Integration and tooling

### D-028 — Driver plus thin host adapters; Vite and Rolldown first

- **Status:** Accepted.
- **Decision:** One shared Driver owns orchestration; host adapters only translate host APIs. Vite and
  Rolldown are P0 hosts. Turbopack is deferred until a host can aggregate emitted CSS.
- **Elaborated in:** [11-integrations](./11-integrations.md).

### D-029 — Distribution without install scripts

- **Status:** Accepted.
- **Decision:** Native binaries ship as per-platform packages selected through `optionalDependencies`,
  with a WASI build as fallback. No package runs a postinstall script. npm, pnpm, Yarn and Bun are
  supported package managers; Node.js LTS, Bun and Deno are supported runtimes.
- **Elaborated in:** [11-integrations](./11-integrations.md), the repository notes.

### D-030 — Language-server-first editor tooling

- **Status:** Accepted.
- **Decision:** Editor features come from a Rust language server speaking LSP. Kirana ships no
  tsserver plugin.
- **Rationale:** TypeScript 7 (`tsgo`), which this repo already uses, does not support the classic
  tsserver plugin API.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md).

### D-031 — Lint rules come from the compiler

- **Status:** Accepted.
- **Decision:** Lint rules ship as `@kirana-style/eslint-plugin`, an ESLint-compatible plugin loaded by Oxlint
  (`jsPlugins`) or ESLint. Rules read the compiler's inspection output and release in lock-step with
  the compiler. Kirana ships no formatter.
- **Rationale:** StyleX's `valid-styles` rule lagged its compiler and reported about 150 false positives
  in the StyleX port.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md).

## Process

### D-032 — Correctness before performance claims

- **Status:** Accepted.
- **Decision:** No performance claim is published until the conformance suite passes on the same
  corpus. Every published number follows the claims policy.
- **Elaborated in:** [14-benchmark-methodology](./14-benchmark-methodology.md), [15-testing-and-conformance](./15-testing-and-conformance.md).

### D-033 — Feasibility inside this monorepo

- **Status:** Accepted.
- **Decision:** The feasibility phase lives under `packages/kirana/` in this repository, validated
  against our shadcn/ui port's StyleX packages and its Tailwind twin.
- **Elaborated in:** the repository notes, the roadmap.

### D-034 — VoidZero-first project tooling

- **Status:** Superseded by D-040.
- **Decision:** Kirana's own repository uses Oxlint, Oxfmt, Vite/Vitest and Rolldown-based packaging for
  JavaScript, and `rustfmt`, Clippy and `cargo-deny` for Rust.
- **Elaborated in:** the repository notes.

## Implementation (Sprint 1)

Decisions adopted while building M0 and M1; each row of
the implementation tracker names its evidence.

### D-035 — The definition decides a token's representation

- **Status:** Accepted; amended by D-086 (a variable token is declared only where something uses it).
- **Decision:** A token's own definition decides how it compiles. A plain value is inlined. A
  `{ light, dark }` colour is inlined as `light-dark()`. A token declared `variable: true` (per token, or
  for the group with `defineTokens(namespace, values, { variable: true })`) and every non-colour mode
  value is a custom property. `defineTheme` overrides only variable tokens (`token-not-variable`). A
  variable token used as a computed key assigns its custom property: `{ [ctx.iconSize]: "1rem" }`.
- **Rationale:** Choosing by project-wide usage (D-008) made a module's output depend on which other
  modules had compiled, which breaks incremental builds and determinism, and it left runtime token
  values without fixed text.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md), [06-authoring-api](./06-authoring-api.md).

### D-036 — One atoms layer in ladder order

- **Status:** Accepted; elaborated by D-087 (order within a conflict key).
- **Decision:** The layer plan is `@layer {before}, kirana, {after}` with sublayers `kirana.tokens`,
  `kirana.themes`, `kirana.contextual` and `kirana.atoms`. Atoms are written into the single
  `kirana.atoms` layer in ladder order, and every atom selector has specificity (0,1,0) through
  `:where()`.
- **Rationale:** With equal specificity, source order already is the ladder; one sublayer per ladder
  bucket only added bytes.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md), [13-output-and-performance](./13-output-and-performance.md).

### D-037 — Fixed-width class names, identical in development

- **Status:** Accepted; amended by D-084 (dense names in production, opt-in).
- **Decision:** A class name is
  `{prefix}{property code}[-{target 3}][-{conditions 4}]_{value 4}`. The property code is the base-62
  index of the longhand in the generated property table, or a 5-character hash for a custom property.
  Definition names — relation markers, theme classes, keyframes and variable tokens — are the prefix,
  a kind letter and a 4-character hash, and two definitions that take one name are the same error as
  two atoms that do.
  The other segments are base-62 text from XXH3-64 hashes of the normalized target, condition set and
  value; the value hash includes the longhand count when a shorthand set more than one. Widths never
  change: a collision is the `class-name-collision` error. Tombstones `{prefix}{key}_` and
  `{prefix}{property}*_` carry `null` removals into runtime merges and never reach the DOM. Development
  and production use the same names and the same cascade order; they differ only in source maps and
  minification. Hash inputs never include file paths.
- **Rationale:** Lengthening names on collision (D-024) made a name depend on which modules compiled
  first. Readable names now come from `kirana-style trace` and the language server. The value segment is
  four characters, not the three first shipped: measured over the three applications, three left a
  1.5–3.1 % chance per build of a collision, which fails the build with nothing the author can do
  about it, and widening is the only fix that keeps a name a function of its own atom
  (`packages/kirana/design-notes/class-names.md`).
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md), [09-dynamic-styles](./09-dynamic-styles.md#private-runtime), [13-output-and-performance](./13-output-and-performance.md).

### D-038 — Compound condition keys and `relation().before`

- **Status:** Accepted.
- **Decision:** A condition key may be a compound selector (`"[aria-haspopup]:active"`); it splits into a
  condition set. Relations gain `.before(state)` for a reader that precedes its anchor as a sibling.
- **Rationale:** Both occur in the ported components (StyleX `siblingAfter`).
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-039 — One-stage prefilter

- **Status:** Accepted.
- **Decision:** The prefilter is one byte scan for `@kirana-style/` or an `sx` attribute. Modules that only use
  imported style values are left untouched; imported modules are parsed on demand when an importer
  needs their values evaluated.
- **Rationale:** Compiled style values are ordinary runtime strings and objects, so static inlining
  across modules is an optimization, never a correctness requirement.
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md), [13-output-and-performance](./13-output-and-performance.md).

### D-040 — TypeScript source packages during feasibility

- **Status:** Accepted; refined by D-050 (packages are compiled at pack time, and relative imports now
  carry their extension).
- **Decision:** During the feasibility phase `@kirana-style/*` npm packages export their TypeScript source,
  run directly by Node.js type stripping, Bun and Vite, with extensionless relative imports so consumer
  `tsconfig`s type-check them. Packaging with Rolldown-based tooling returns with distribution at M4.
  The rest of D-034 stands: Oxlint, Oxfmt, Vite/Vitest, `rustfmt`, Clippy and `cargo-deny`.
- **Rationale:** Every consumer lives in this monorepo; a JavaScript build step would only add stale
  output.
- **Elaborated in:** the repository notes.

### D-041 — `sx` on external components is reported

- **Status:** Accepted.
- **Decision:** `sx` given to a component imported from an installed package is the
  `sx-on-external-component` warning; the fix is `{...props(...)}`.
- **Rationale:** Such components do not know the prop; the port's first render left every Base UI
  primitive unstyled without a message.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [10-compiler-architecture](./10-compiler-architecture.md).

### D-042 — Narrower declarations win at ladder step 5

- **Status:** Provisional — reopened by experiment E-03 (cascade ladder).
- **Decision:** Between atoms that tie through ladder step 4, the declaration that set fewer longhands
  wins; at equal count a physical longhand beats a logical one.
- **Rationale:** `borderWidth` followed by `borderInlineStartWidth: 0` must end with the narrower
  override winning, as in StyleX and Tailwind; a fixed logical/physical rank inverted it.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-043 — Recipes merge their parts at runtime

- **Status:** Provisional — reopened by experiment E-05 (dynamic model).
- **Decision:** A runtime recipe call merges the base, the chosen option of each variant group and the
  matching compound entries through the private runtime. No mixed-radix variant table is precomputed.
- **Rationale:** Same semantics with output linear in the number of options; a table grows with their
  product.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [09-dynamic-styles](./09-dynamic-styles.md).

### D-044 — The writer minifies; Lightning CSS lowers

- **Status:** Accepted.
- **Decision:** The engine writes CSS from the Style IR itself, minified by its own printer. Lightning CSS
  (unmodified, MPL-2.0, a dependency only) splits shorthands into typed longhands and lowers syntax
  when configured targets are below the default floor.
- **Rationale:** Lightning CSS's minifier resolves `color-mix()` and rewrites colours even at the floor
  targets, which D-026 forbids.
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md), [13-output-and-performance](./13-output-and-performance.md), the licensing notes.

### D-045 — Shorthand atoms with exact merging

- **Status:** Accepted (closes experiment E-04's packaging question).
- **Decision:** A box-family shorthand with one component, a shorthand the typed parsers cannot split, and
  a bridged shorthand compile to **one shorthand atom** that covers its longhands; typed multi-component
  values still expand. Merging stays per longhand (D-011): a write unfolds partially overlapping atoms no
  broader than itself (all of them for a removal), narrowest first; removes the shorthands it covers; and
  sets the atom. `Unfold` replaces an earlier atom, in its place, by the longhands it still owns, reusing the
  atom's value segment; only longhand entries after the atom keep their values. Ladder step 5 compares **breadth** — the number of longhands, with a secondary shorthand ranked
  one above the largest box family it partly overlaps (amends D-042). The property table lists the 31 box
  families first, each shorthand followed by its longhands, so a family atom's code locates its longhands
  and removes them without tombstones (amends D-037's code assignment).
- **Rationale:** Expansion cost 434 extra rules and 2.0 kB gzip on the demo. Keeping shorthands whole
  mirrors StyleX's `property-specificity` and Panda's property order; clearing longhands mirrors StyleX's
  `application-order`; unfold, breadth and derived codes make the result exact where both StyleX modes are
  not, at 0 bytes of runtime tables.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md#longhand-expansion),
  [09-dynamic-styles](./09-dynamic-styles.md#private-runtime), [10-compiler-architecture](./10-compiler-architecture.md#hashing-and-names),
  `packages/kirana/design-notes/shorthand-atoms.md`.

### D-046 — Conformance is arbitrated by the third implementation

- **Status:** Accepted (2026-09-15).
- **Decision:** A conformance run compares Kirana with one baseline and uses the other as arbiter. Against
  the StyleX port, a difference where Kirana matches the Tailwind original is a correction; against the
  original, a difference the StyleX port shares with the same value is inherited. Anything else fails.
  Routes are crawled from each app, each is loaded once per implementation, and a difference must repeat
  on a second capture. The expected-differences list is kept for exceptions neither arbiter explains.
- **Rationale:** With blocks and examples back, the port differs from the original in thousands of
  (route, element, property, setting) places, and Kirana corrects the port in some. A hand-kept list could
  not follow either; the arbiter states the goal itself — render like the port, or like the original where
  the port is wrong.
- **Elaborated in:** [15-testing-and-conformance](./15-testing-and-conformance.md#browser-conformance-suite),
  `conformance/README.md` in the benchmark repository.

### D-047 — Registered tokens and `sx` forwarding checks

- **Status:** Accepted (2026-09-15).
- **Decision:** A token written `{ value, syntax, inherits? }` is registered with `@property` (KRN-TOK-011);
  variable tokens are keyframe keys. `sx-on-external-component` also reports `sx` given to a project
  component that spreads it, unread, onto an installed component or a host element (KRN-API-016).
- **Rationale:** The full port needed an animatable custom property (StyleX's `stylex.types`), and it had
  two wrappers that silently dropped their callers' styles, which type-checking cannot see because every
  element's attributes carry `sx`.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md),
  [06-authoring-api](./06-authoring-api.md), [10-compiler-architecture](./10-compiler-architecture.md).

### D-048 — What "not slower at runtime" means

- **Status:** Accepted.
- **Decision:** KRN-PERF-006 is measured per operation, not as one total. Kirana's style
  recalculation **per interaction** must be at parity with the StyleX port's, and a **whole-page
  restyle** — switching colour scheme — must be within 15 % of it. E-07's exit criterion follows.
- **Rationale:** The first measurement (E-07, 2026-09-21) put Kirana 9.2–11.3 % behind the StyleX
  port on a lumped total, and splitting it showed where: a colour-scheme switch costs 848 ms against
  6 ms for hovers, so the total _was_ the scheme switch and said nothing about the interactions a
  person actually performs. Per hover the two are level (6.0 ms against 4.6 ms at 4× throttling,
  7.0 against 6.9 at 6×) and both are 4–5× ahead of Tailwind. The remaining gap is 10 % more rules
  in the document from longhand expansion, which is what buys merging per entry — the same trade as
  the raw-CSS gap, and not something to hold a requirement open against. A bar of "never one per
  cent worse at anything" cannot be met by a design that chose different semantics, and would have
  been carried open forever.
- **Elaborated in:** [13-output-and-performance](./13-output-and-performance.md),
  the roadmap, `packages/kirana/design-notes/benchmark-results.md`.

### D-049 — No persistent cache until something is waiting on it

- **Status:** Accepted; its measurement is amended by D-085 (one compile per module in a build).
- **Decision:** KRN-CMP-010 (a per-module cache under `node_modules/.cache/kirana`) is deferred out
  of M2 and not scheduled. The in-memory incremental graph stays: it is what the dev server and a
  watch build use, and it is not affected.
- **Rationale:** The engine is **0.05 s** of a **16.2 s** production build of the three applications
  (E-02, 2026-09-22). A cache whose whole purpose is to skip that work cannot save time anyone can
  measure, and it is not free: the key has to carry the compiler version, the configuration hash,
  every module's content hash and its provenance hashes, and missing any one of them produces wrong
  CSS from a stale entry — against a requirement that says deleting the cache must never change
  output. Turborepo already replays an unchanged build in 1.7 s, which is the saving people actually
  wanted. Revisit if the engine's share ever becomes visible; the measurement to re-run is
  `kirana-style check --stats` and the corpus benchmark.
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md),
  the roadmap.

### D-050 — Source in the workspace, compiled output in the package

- **Status:** Accepted. Refines D-040.
- **Decision:** The workspace keeps consuming `@kirana-style/*` as TypeScript source (D-040 stands for
  everything inside this repository). What a user installs is built at pack time by
  `scripts/pack.ts` in a staging copy: `tsc` compiles each source file to one ESM file with its
  declaration (`--rewriteRelativeImportExtensions`), `exports` point at `{ types, default }`,
  `workspace:` and `catalog:` versions are resolved, development fields are dropped, and `npm pack`
  writes the tarball. Relative imports therefore carry their `.ts` extension, which is what makes
  the rewrite produce imports Node resolves (D-040's extensionless imports are withdrawn; a workspace consumer that type-checks the source sets `allowImportingTsExtensions`, as every one here does). The native
  engine ships as `@kirana-style/compiler-<triple>`, one per KRN-INT-007 target, listed in
  `@kirana-style/compiler`'s `optionalDependencies`; the Driver loads that package first, falls back to a
  `kirana.<triple>.node` next to itself only when the package is not installed (the workspace case),
  and rethrows when it is installed but fails to load. Linux gnu builds link against glibc 2.17.
- **Rationale:** A one-to-one compile needs no bundler, so `tsdown` (doc 11's original choice) would
  add a dependency to do what the TypeScript compiler already does — and a package that is compiled
  file by file keeps its module graph, which is what a consumer's own bundler tree-shakes. Keeping
  source in the workspace keeps D-040's benefit (no stale output) where every consumer lives, while
  the install tests (E-08) prove the built form. A broken installed engine is reported instead of
  masked, because falling back to a different binary would hide the one fault a user can act on.
  Building on the runner's glibc (2.39 on `ubuntu-24.04`) would refuse to load on Debian 12,
  Ubuntu 22.04 and RHEL 9.
- **Elaborated in:** [11-integrations](./11-integrations.md#package-managers-and-distribution),
  the repository notes.

### D-051 — Ecosystem before developer experience

- **Status:** Accepted.
- **Decision:** The milestones run M4 (ecosystem), M5 (utility surface), then M3 (developer
  experience). Language-server support for utility strings moves from M5 to M3, because the language
  server does not exist before M3. M4 includes installation and compatibility tests in CI: packed
  tarballs installed with every supported package manager on every supported OS, and every host
  example built and checked in a browser.
- **Rationale:** An engine nobody can install outside this repository cannot be evaluated by anyone
  else, and the adapters and frameworks are what decide whether it can be adopted at all; editor
  support improves the experience of people who have already adopted it. Proving installation on
  every change, rather than at release, catches the platform- and package-manager-specific failures
  that only show up there — Yarn resolving every optional platform package is one, found while
  building the matrix.
- **Elaborated in:** the roadmap.

### D-052 — How a host without Vite finishes the stylesheet

- **Status:** Accepted.
- **Decision:** Every adapter compiles modules the same way and differs only in where the finished
  stylesheet goes:
  - **Rolldown alone** does not bundle CSS: the adapter emits the stylesheet as an asset of its own
    (`kirana.css`, configurable) and the import of `@kirana-style/core/stylesheet.css` yields that name.
  - **webpack and Rspack** treat the entry as ordinary CSS; the loader answers it with the
    placeholder, and the plugin writes the finished stylesheet into the emitted asset at
    `processAssets`' optimize stage — after every module, before the CSS minimizer, and before
    `realContentHash` renames the file by its real content.
  - **Bun** loads the entry as the placeholder and rewrites the emitted CSS file in `onEnd`.
  - Every compiler that builds one project — root and configuration — shares one Driver.
- **Rationale:** Rebuilding the stylesheet module once every module is built (`finishModules` +
  `rebuildModule`) would let the host hash the right content from the start, and works on webpack,
  but Rspack 2 panics doing it under Rsbuild's CSS extraction ("should have event sender"); filling
  the asset works on both, and `realContentHash`, on by default in production in both, keeps the
  name honest. Sharing the Driver is what makes Next.js work: a server component is compiled only by
  the server compiler, and the stylesheet is written by the client one.
- **Consequences:** With `realContentHash` off, or a Bun `naming` pattern that hashes CSS, the file
  name carries the placeholder's hash. Development servers other than Vite's rewrite the stylesheet
  on every watch build but send no CSS hot update yet.
- **Elaborated in:** [11-integrations](./11-integrations.md#bundlers-and-build-tools).

### D-053 — Components compile their scripts; template bindings merge at runtime

- **Status:** Accepted.
- **Decision:** Vue, Svelte and Astro components are compiled when the host reads them: each script
  block is compiled by the engine as a module of its own, and each `sx` binding in the template
  becomes a spread of the private runtime's `sx()` with the `class` attribute (Vue
  `v-bind="…"`, Svelte and Astro `{...…}`, the element's own `class` and `style` folded in). The
  framework's own parser finds the blocks and bindings. Astro users install `@kirana-style/astro`, which
  renames the finished stylesheet after Astro has written its pages.
- **Rationale:** Compiling after the framework would mean reading each framework's private output;
  one TSX module per component cannot express template scope (`{#each}` items, slot props). Merging
  at runtime costs one call per bound element and uses the same merge as dynamic `sx` in JSX, so the
  classes are the ones JSX would produce. Compiling at `load` rather than `transform` is what works
  on Astro, whose plugin compiles `.astro` files ahead of every user plugin. Full comparison:
  `packages/kirana/design-notes/sfc-masking.md`.
- **Consequences:** `css()` inside a template expression is not compiled (it throws when run);
  template bindings get no element diagnostics; every bound element merges at runtime.
- **Elaborated in:** [11-integrations](./11-integrations.md#frameworks).

### D-054 — Published libraries ship styles uncompiled

- **Status:** Accepted. Supersedes the `kirana-style build --library` manifest in KRN-INT-008.
- **Decision:** A published Kirana library ships its `css()` calls uncompiled and no CSS; an
  application lists it in `libraries`, and every adapter compiles that package's modules from
  `node_modules` with the application's own. `kirana-style build --library` and `kirana.manifest.json`
  are withdrawn.
- **Rationale:** A precompiled library bakes its compiler version and configuration into class
  names. Through the real runtime, `cx(libraryStyle, appOverride)` keeps both classes when the
  prefixes differ (`"ds50_aaaa k50_bbbb"`), so the override wins only by stylesheet order; and a
  library built before this repository's hash widening (`b527766`) ships the same declaration twice
  beside the application's. Compiling in the application costs nothing measurable — 106 files in
  63 ms — and gives exact deduplication, one configuration and cross-package tokens with no manifest
  format to version. Evidence and the rest of the comparison:
  `packages/kirana/design-notes/published-libraries.md`.
- **Consequences:** An application without Kirana cannot use a Kirana library. A library that is not
  listed throws at its first `css()` with a message naming `libraries`.
- **Elaborated in:** [11-integrations](./11-integrations.md#monorepos-and-published-libraries).

### D-055 — The WASI engine is the fallback, and must match native byte for byte

- **Status:** Accepted.
- **Decision:** The engine is also built for `wasm32-wasip1-threads` (napi-rs with emnapi) and
  published as `@kirana-style/compiler-wasm32-wasi` (`cpu: ["wasm32"]`, so only a WebContainer or an
  explicit install gets it). The Driver loads it when no native addon is installed, when one is
  installed but fails to load (with a warning), or when `KIRANA_FORCE_WASI=1`; `Driver.engine` says
  which is running. CI installs it, forces it, builds an example and requires the stylesheet to be
  byte-identical to the native engine's.
- **Rationale:** KRN-INT-006. Measured on the demo and component library (106 files), the WASI engine
  wrote the same 79,443-byte stylesheet and the same compiled code as native, 2.2× slower (136 ms
  against 63 ms) — acceptable for a fallback. napi-rs 3 links against emnapi 2, which is still a
  prerelease (`2.0.0-alpha.5`); it is a build-time library and pinned.
- **Elaborated in:** [11-integrations](./11-integrations.md#runtimes).

### D-056 — Conformance on every host means the same atoms as on Vite

- **Status:** Accepted. Restates M4's exit criterion "full three-way conformance passes on every host".
- **Decision:** Conformance is measured on Vite, where the three applications are built and compared
  with the StyleX port and the Tailwind original. Every other host must compile the same source to
  the same Kirana atoms: CI builds one React example on Vite, Rolldown, webpack, Rsbuild, Next.js,
  Bun and esbuild and requires identical class-name sets (`examples/compare-atoms.ts`). The three
  applications are not rebuilt with every bundler.
- **Rationale:** An adapter only passes a module's source to the one engine and places its output
  (D-028); what styles a page is the engine's output, whose byte-for-byte determinism across
  platforms and thread counts is already checked on the full corpus. What an adapter can still get
  wrong — dropping a module, compiling one twice, losing the atoms of a compiler it did not see
  (Next.js's server components, found this way) — shows as a different atom set. Rebuilding
  TanStack Start applications with webpack, Rspack, esbuild and Bun would mean porting their
  routing and server rendering to each, which tests the port, not Kirana.
- **Elaborated in:** the roadmap,
  [11-integrations](./11-integrations.md#bundlers-and-build-tools).

### D-057 — Utilities lower to the object a person would write

- **Status:** Accepted. Answers Q-04; builds KRN-API-012.
- **Decision:** String values of `sx` are utilities. A preset declares a utility grammar as data —
  where scale values come from (module and export), what each utility root sets, what each variant
  is — and the engine lowers a string to the style object it stands for, reading scale values
  through the same import resolution a real `import` uses, then passes that object to the function
  `css()` uses. Strings only, no template tags; a template literal with substitutions is
  `utility-not-static`. `@kirana-style/preset-scales/preset` ships Tailwind v4's names over its scales.
- **Rationale:** One style path means the utility and object forms produce the same atoms by
  construction, and every diagnostic applies to both; a property test generated from the grammar
  (6,915 utilities) holds that. Keeping the vocabulary as data keeps compiler code out of presets
  (KRN-TOK-008) and lets an application point a scale at its own semantic tokens. Template tags add
  a function the type checker cannot help with for nothing a string does not already give.
- **Consequences:** `!important`, `group-*`/`peer-*` and arbitrary selector variants are not
  utilities (`utility-unsupported`, pointing to the cascade, `relation` and `select`). The preset is
  imported from its own entry, since a configuration file runs uncompiled.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md#the-utility-surface),
  `packages/kirana/design-notes/utility-surface.md`.

### D-058 — The Tailwind codemod shares the utility lowering

- **Status:** Accepted. Builds the second row of KRN-API-013.
- **Decision:** `kirana-style migrate tailwind` has no Tailwind parser of its own. The utility lowering moves
  into `kirana_utility`, which describes values symbolically (a token by module, export and path;
  negation, alpha, text around tokens); the engine renders them as IR, the codemod as source
  (`color.blue[600]`, `` `calc(${space[2]} * -1)` ``). What a string cannot say but an object can —
  relations, contextual targets, arbitrary properties, `dark:` as `light-dark()` — is the codemod's own.
  The grammar grows the mechanisms the Tailwind original needed, as data: numbers that are not keys,
  `(--x)`, pseudo-element variants, Tailwind's built-in variant forms, and composed utilities through
  `{scale.key}` token references, with the preset's `compose` tokens registered `inherits: false`.
- **Rationale:** one lowering makes the codemod's output compile to the atoms of the string it
  replaced (a test compares them), and every vocabulary fix helps both surfaces. Measured on the
  Tailwind original of the shadcn/ui port: 1,183 report items with the first grammar, 535 after these additions, with 8
  compile errors left, all reported (`design-notes/migrate-tailwind.md`).
- **Consequences:** filters are not composed yet (Tailwind's chain relies on empty `var(--x,)`
  fallbacks, which a token cannot express); the `tw-animate-css` plugin's utilities are not in the
  preset; `cn` conflict deletions and wrapper defaults are not detected. A grammar's relative modules
  are resolved from the project root when the configuration is read.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md#migration-codemods),
  `packages/kirana/design-notes/migrate-tailwind.md`.

### D-059 — Unset registered tokens; the animation vocabulary in the scales preset

- **Status:** Accepted. Extends KRN-TOK-011 and D-058.
- **Decision:** A registered token of the universal syntax may have no value: `@property` without
  `initial-value`, and references written `var(--k…,)`. `@kirana-style/preset-scales` composes Tailwind's
  filter and backdrop-filter chains through such tokens, and carries tw-animate-css's vocabulary
  (`animate-in`/`out`, `fade-*`, `zoom-*`, `spin-*`, `blur-in`/`out`, `slide-in-from-*`,
  `slide-out-to-*`, the accordion, collapsible and caret animations) with Tailwind's `spin`, `ping`,
  `pulse` and `bounce`, as keyframes and registered layers whose initial values are the plugin's
  fallbacks. `duration-*` and `ease-*` also set the animation's duration and easing layers, and
  `delay-*` the animation delay, as the plugin's utilities do.
- **Rationale:** Tailwind's filter chain is `var(--tw-blur,) var(--tw-brightness,) …`; a token that
  always has a value could only give an identity (`blur(0)`), which computes to a different `filter`
  than the original. With unset tokens the output has the same shape. The animation utilities were 163
  of 535 report items on the Tailwind original, and shadcn/ui depends on the plugin, so they belong
  with the preset its users adopt; the plugin is MIT and credited.
- **Consequences:** `slide-in-from-start`/`end` (direction-dependent declarations) are not in the
  grammar. `animation-duration-*` and `duration-*` set the same layer, so the later one in a string
  wins where Tailwind would prefer `animation-duration-*`; the accordion animations keep the plugin's
  0.2 s default and do not follow `duration-*`.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md), `packages/kirana/design-notes/utility-surface.md`.

### D-060 — Uniform box utilities lower to both logical axes

- **Status:** Accepted. Refines D-057.
- **Decision:** `p-*`, `m-*`, `scroll-p-*`, `scroll-m-*` and `inset-*` lower to their two logical axes
  (`paddingBlock` and `paddingInline`), not the physical shorthand (`padding`).
- **Rationale:** the value is the same on all four sides, so both forms compute identically in every
  writing mode. What differs is merging: shadcn/ui relies on `cn()` (tailwind-merge) deleting an
  earlier `py-4` when a caller passes `p-0`, and under Kirana's ladder a physical `padding` loses to a
  narrower logical `paddingBlock` whatever the order (KRN-CAS-008 rule 7). Written as the axes, a
  later `p-0` replaces the earlier `paddingBlock` entry for entry. Measured on the migrated Tailwind
  original's `web` page: the tooltip trigger's `Card` (`p-0` over the card's `py-4`) was 96 of 843
  differences, all gone.
- **Consequences:** `p-4` is two atoms instead of one. `pt-4` after `p-0` still wins (narrower), as in
  Tailwind; `pt-4` before `p-0` also wins, where tailwind-merge would have deleted it.
- **Elaborated in:** `packages/kirana/design-notes/utility-surface.md`.

### D-061 — A contextual target may carry pseudo-classes

- **Status:** Accepted. Extends KRN-CAS-006.
- **Decision:** `select.child()` and `select.descendant()` take one compound selector: an optional
  element name, attribute selectors and pseudo-classes (`span:last-child`, `a:hover`,
  `svg:not([data-icon])`). Combinators, pseudo-elements and class selectors stay errors.
- **Rationale:** a pseudo-class is as verifiable as an attribute — it names the target's own state or
  position, not markup the compiler cannot see — and contextual rules live in their own layer, below the
  target's own styles, so the ladder is unaffected. shadcn/ui's `[&>span:last-child]:truncate` and
  `*:hover:…` had no Kirana form: 58 of the migrated Tailwind original's report items were targets or
  target states.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-062 — A build checks R1 only for relations it compiled

- **Status:** Accepted. Narrows R1 (08) in a bundler build; `kirana-style check` is unchanged.
- **Decision:** in a build, a relation read whose declaring module the build never compiled is not
  reported as `relation-without-anchor`. `kirana-style check`, which compiles every module of the project,
  still reports it when no module anywhere applies the anchor.
- **Rationale:** a style's import of a relation is removed with the style, so the declaring module
  enters the build only when something else imports it. A shared component reading an ancestor that
  only some applications render — the migrated `InputGroup` reading `in-data-[slot=combobox-content]`
  in `apps/web`, which renders no combobox — failed the build although the read is correct and simply
  never matches there. When the declaring module is compiled, R1 applies as before: a relation declared
  and read with no anchor anywhere in the build is still an error (fixture `relations-project-wide`,
  and `relations-declared-outside-build` for this case).
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-063 — The M3 lint rule set

- **Status:** Accepted. Resolves the candidate rules of KRN-DX-009.
- **Decision:** `@kirana-style/eslint-plugin` ships nine rules (eleven since `no-dark-variant` and
  `no-class-helpers`; Biome in D-079). `recommended` (problems that lose styles or
  that the build reports): `diagnostics`, `sx-last`, `no-conflicting-props`,
  `override-keeps-conditions`, `no-classname-on-sx`, `no-unused`. `strict` adds the stylistic and
  advisory ones: `sort-properties`, `prefer-token`, `finite-bridge`. Of the candidates, unused handles
  and variants became `no-unused` and a `className` reaching an `sx` component became
  `no-classname-on-sx`; restricted overrides (`Sx<"color">`) are a type-level feature of
  `@kirana-style/core`, not a lint rule, and are not built; the codemod's "outranks a contextual rule"
  report stays a migration report. Two rules were added: `no-conflicting-props` (StyleX has the same
  rule for `stylex.props`) and `override-keeps-conditions`, the carried "plain value after a
  component's conditional entries" item, reported only for structural (attribute) conditions so a
  component's `:hover` over a caller's plain value — usually intended — is not flagged.
- **Rationale:** each rule either prevents a style that silently never applies or relays the compiler;
  none re-implements CSS validation, which `diagnostics` already carries at the property's span. The
  repository lints itself with `recommended`; on first run it found 19 ambiguous-precedence warnings in
  `packages/ui` that were declared exclusive in `uiConfig` but invisible to a tool run inside the
  package (it now has `kirana.config.ts`), three real ambiguous-precedence ties, an unsplittable
  shorthand, and 21 unused style handles in the docs
  app (19 removed, two kept for a commented-out logo mark).
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#lint).

### D-064 — Editors live under `editors/`, and run the project's own engine

- **Status:** Accepted. Settles doc 16's `packages/vscode` against doc 22's `editors/vscode`.
- **Decision:** the VS Code and Zed extensions live in `packages/kirana/editors/`. Neither bundles the
  engine: both start the project's own `node_modules/.bin/kirana lsp`, falling back to a configured
  path, so the editor runs the exact engine release the build does (KRN-DX-001).
- **Rationale:** an extension that bundled its engine would disagree with the build the day the
  project upgrades Kirana, which is the failure the language server exists to prevent.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#language-server),
  the repository notes.

### D-065 — Turbopack through a loader and a PostCSS plugin

- **Status:** Accepted. Closes R-09.
- **Decision:** Next.js with Turbopack is supported by two packages. `@kirana-style/next` exports
  `withKirana`, which adds a Turbopack loader rule for the project's scripts and keeps the webpack
  plugin for `next build --webpack`; `@kirana-style/postcss` replaces the `@kirana;` directive in a global
  stylesheet with the stylesheet of the whole project. `@kirana-style/webpack/next` stays for webpack-only
  projects.
- **Rationale:** Turbopack runs loaders and PostCSS, not bundler plugins, so nothing sees every module's
  atoms in one place. Tailwind CSS v4 and StyleX solve the same problem the same way. Kirana needs no
  coordination between the two sessions because a class name never depends on build order (D-037).
- **Trade-off:** the plugin compiles every script of the project, so atoms of a component nothing
  imports are emitted, and the project is compiled twice. Measured in `design-notes/turbopack.md`
  (53 ms for the 104 scripts of `apps/docs` cold, 5 ms after an edit).
- **Elaborated in:** [11-integrations](./11-integrations.md#bundlers-and-build-tools).

### D-066 — `kirana-style init` edits after showing a diff, and never installs unasked

- **Status:** Accepted.
- **Decision:** `kirana-style init` detects the framework, bundler and package manager, then writes
  `kirana.config.ts`, wires the adapter into the host's configuration and adds the stylesheet. It shows
  every change as a diff and asks before writing (`--yes` skips the question, `--dry-run` only shows).
  It prints the install command and runs it only with `--install`. Where a configuration file is not in
  a shape it recognises, it prints the step to do by hand instead of guessing.
- **Rationale:** setup touches files a project owns; a diff makes the change reviewable, and a printed
  command keeps the package manager's lockfile under the user's control.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#cli).

### D-067 — Qwik is a JSX mode, on Qwik 2

- **Status:** Accepted.
- **Decision:** `jsx: "qwik"` compiles `sx` to `class`, detected from `jsxImportSource`
  `@qwik.dev/core` or `@builder.io/qwik`. Supported on Qwik 2, which runs on Vite 8.
  `@kirana-style/core/qwik` types `sx`. The Vite adapter gains a second plugin, `kirana:late`, that fills
  stylesheet assets added after its first `generateBundle` pass.
- **Rationale:** Qwik's JSX differs from Solid's only in its runtime; the attribute and the source are
  the same, so a mode is enough and no framework engine is added. Qwik 1 supports Vite 7 and older,
  and `@kirana-style/vite` requires Vite 8.
- **Trade-off:** Qwik 2 was a release candidate (2.0.0-rc.0) when this landed; the example pins it.
- **Elaborated in:** [11-integrations](./11-integrations.md#frameworks).

### D-068 — Angular through a runtime directive, and builders for the CLI

- **Status:** Accepted.
- **Decision:** `@kirana-style/angular` styles Angular templates with `SxDirective` (`[sx]`), which merges
  handles with the private runtime. Analog compiles after Angular, through the Vite adapter with
  `enforce: "post"`. The Angular CLI uses Kirana's builders, which hand Angular a compiled mirror of
  the sources (`.kirana/`) through `fileReplacements`. The directive's partial declarations
  (`ɵɵngDeclareFactory`, `ɵɵngDeclareDirective`) are written by hand under `src/fesm2022/`.
- **Rationale:** a template reaches only component members, so a compile-time rewrite of `sx` would
  need Angular's template compiler, a framework engine D-028 rules out. Angular reads sources from
  disk through its own TypeScript host in both `@angular/build` and Analog, so a source transform
  before it is impossible; Analog emits one module per file, which can be compiled after, and the CLI
  honours `fileReplacements`, which redirects module resolution. The declarations are hand-written
  because this workspace's TypeScript 7 has no JavaScript API for `ngc`; under `fesm2022/` because
  Analog's linker processes only files on such a path.
- **Trade-off:** the merge runs in the browser (the private runtime, under 1.1 kB gzipped) instead of at
  build time, and the CLI compiles the source root twice (once into the mirror, once by Angular).
- **Elaborated in:** [11-integrations](./11-integrations.md#frameworks),
  `design-notes/angular.md`.

### D-069 — Server templates read a class map

- **Status:** Accepted.
- **Decision:** `classes: { modules, out }` in `kirana.config` makes `kirana-style build` and `kirana-style dev`
  write a class map: every handle the modules export, by name (dotted inside objects), as its class
  string, with the prefix and the two box-family bounds. Template helpers in PHP (Laravel's `@kirana`,
  Symfony's Twig `kirana()`), Ruby (Rails' `kirana`), Elixir (Phoenix's `kirana/1`) and Node.js
  (AdonisJS's Edge `kirana()`) merge named strings with the runtime's rules. A recipe or runtime
  value among the exports is `classes-not-static`; a name the editor cannot find is
  `unknown-class-name`.
- **Rationale:** a server template cannot call `css()`, and these frameworks render most of their
  pages from templates. Class names already carry their merge rules, so a template needs only the
  strings and a port of the merge, not the engine.
- **Trade-off:** every exported style is emitted whether a template uses it or not, and the merge is
  ported to four languages; each port is held to `fixtures/merge/vectors.json`.
- **Elaborated in:** [11-integrations](./11-integrations.md#frameworks), `design-notes/class-maps.md`.

### D-070 — Parcel through a transformer and the PostCSS plugin

- **Status:** Accepted.
- **Decision:** `@kirana-style/parcel-transformer` compiles scripts in Parcel's workers; `@kirana-style/postcss`
  writes the stylesheet where `@kirana;` stands, as for Turbopack (D-065). Parcel requires
  transformer packages to be named `parcel-transformer-*`.
- **Rationale:** Parcel has no hook that sees every module, as Turbopack has none.
- **Elaborated in:** [11-integrations](./11-integrations.md#bundlers-and-build-tools).

### D-071 — Gatsby through its webpack stages

- **Status:** Accepted.
- **Decision:** `@kirana-style/gatsby` is a Gatsby plugin whose `onCreateWebpackConfig` adds the webpack
  plugin to every stage; the stages share one session, as Next.js's compilers do.
- **Elaborated in:** [11-integrations](./11-integrations.md#frameworks).

### D-072 — Ember after Embroider; `externals` for bundler-provided modules

- **Status:** Accepted.
- **Decision:** `@kirana-style/ember/vite` runs the Vite adapter after Embroider (`enforce: "post"`) and
  takes `.gjs`/`.gts` modules, so `css()` works in template-tag components; templates merge handles
  with the `sx` helper, a plain function over the runtime. A new configuration key, `externals`,
  lists specifier prefixes a bundler provides and Node.js resolution cannot find; imports from them
  are runtime values without `unresolved-import`. `kiranaEmber()` adds `@ember/`, `@glimmer/` and
  `@embroider/virtual/`; a Meteor app sets `meteor/`.
- **Rationale:** a template-tag module is not JavaScript until Embroider compiles it, and Ember's own
  modules exist only in Embroider's resolver; without `externals` every component warned.
- **Elaborated in:** [11-integrations](./11-integrations.md#frameworks).

### D-073 — Meteor through its Rspack integration; cached modules are compiled from disk

- **Status:** Accepted.
- **Decision:** Meteor 3.4+ bundles app code with Rspack, so `@kirana-style/rspack` is its adapter
  (`rspack.config.js`, peer `@rspack/core` `^1.7.0 || ^2.2.8`). The webpack/Rspack plugin compiles,
  at `finishModules`, every script module the compilation holds that its loader did not compile in
  this process — a persistent cache restores modules without running loaders — before it writes the
  stylesheet.
- **Rationale:** Meteor turns Rspack's persistent cache on for every build; without the pass a cached
  build wrote a stylesheet with no atoms. Any webpack or Rspack project with `cache: { type:
  "filesystem" }` had the same gap.
- **Elaborated in:** [11-integrations](./11-integrations.md#bundlers-and-build-tools).

### D-074 — `firstThatWorks()`: one atom, the preferred value last

- **Status:** Accepted.
- **Decision:** `firstThatWorks(preferred, ...fallbacks)` compiles to one atom whose value carries every
  member, joined by a record separator that cannot occur in a CSS value; the writer emits one
  declaration per member, the preferred last. Members expand and validate one by one and must set the
  same longhands. Members must be static; there is no runtime fallback. One member is that member.
- **Rationale:** one atom keeps merging, class names and deduplication unchanged, and the order of the
  arguments matches StyleX and `var()`. A run whose members expand differently (a `var()` shorthand
  against a splittable value) would leave a browser with a fallback on some longhands and the preferred
  value on others, so it is an error rather than a surprise.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md#firstthatworks).

### D-075 — `positionTry()` is a definition, and its block is checked

- **Status:** Accepted.
- **Decision:** `positionTry(block)` is a named definition like `keyframes()`: a dashed ident hashed from
  the block, an `@position-try` rule in `kirana.tokens` emitted only when referenced (by value, by
  string, or across modules). The block accepts only the properties `@position-try` applies — inset,
  margin, sizing, self-alignment, `position-anchor`, `position-area` — with plain values.
- **Rationale:** a browser drops any other declaration in the block silently, which is the failure
  Kirana reports instead (P6). A fallback has no state of its own, so conditions are rejected rather
  than ignored.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md#positiontry).

### D-076 — `viewTransition()`: the handle is the class name

- **Status:** Accepted.
- **Decision:** `viewTransition(parts)` returns a handle with one marker class that names itself as
  `view-transition-class`; its runtime value, a class string, is therefore both a style for `sx` and the
  name a framework's transition API takes. Parts style `::view-transition-*(*.class)` under `media()` and
  `supports()` only. Kirana never assigns `view-transition-name`.
- **Rationale:** Kirana elements take `sx`, not `className`, while React's `<ViewTransition>` and
  StyleX-shaped code want a class name. One value serves both without a separate `.name`. A
  transition name must be unique per element, so it belongs with the data that makes it unique.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md#viewtransition).

### D-077 — `kirana-style doctor --report`: a bug report that is safe to paste

- **Status:** Accepted.
- **Decision:** `kirana-style doctor --report` writes a Markdown issue body (or JSON with `--json`) from the
  doctor's checks, the engine's hidden `kirana-style report` (version, work counts, stylesheet size, each
  diagnostic code with its count and first location) and, with `--trace`, `kirana-style trace` output. It
  never includes source text; the project root, home directory and user name are replaced, and
  configuration values under keys that name a secret are masked.
- **Rationale:** a bug report should carry what CONTRIBUTING asks for without a second round trip, and
  a dump of source and absolute paths is something people should not have to scrub before posting.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#cli).

### D-078 — Agent skills live in the repository, and their references are generated

- **Status:** Accepted.
- **Decision:** two skills, `kirana` and `kirana-migrate`, in `skills/` at the repository root, installed
  with `npx skills add`. A skill holds rules and a workflow, and links to the markdown docs instead of
  copying them. Its diagnostics and lint references are generated from the compiler's catalogue and the
  lint plugins; what to do about each diagnostic is written once in the generator, which fails when a
  code has no line.
- **Rationale:** `llms.txt` explains Kirana when an agent asks; a skill is loaded by the agent itself
  when the task matches, which is what stops Tailwind habits. References copied by hand would drift from
  the compiler; generated ones cannot.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#agent-skills).

### D-079 — Biome gets the syntactic rules; the compiler's reach Biome through `check`

- **Status:** Accepted.
- **Decision:** `@kirana-style/biome-plugin` ships the four rules a GritQL pattern can express exactly, held to
  the ESLint originals' reports by a test. Rules that need the compiler or another file, and the two
  whose analysis GritQL cannot express (`no-unused`, `sort-properties`), are not approximated.
- **Rationale:** an approximate rule that disagrees with the ESLint one would undo the promise that lint
  and build never disagree. `kirana-style check --format github` gives a Biome project the compiler's own
  diagnostics in CI.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#lint).

### D-080 — `kirana-style export`, schema 1

- **Status:** Accepted.
- **Decision:** the design system as JSON, from the session's own records: tokens from the token
  catalogue, themes, recipes and named definitions from modules' evaluated exports, relations from the
  relation registry. A field is added without changing `schema`; renaming or removing one changes it.
- **Rationale:** an agent or a design tool should use the names a project has, without parsing its
  source; a sorted, stable file diffs cleanly in review.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#design-system-export).

### D-081 — `check --format github` and `--max-warnings`

- **Status:** Accepted.
- **Decision:** `github` prints one workflow command per diagnostic (`::error file=…,line=…,col=…,title=KRN… name::message`,
  infos as notices, `%`, CR and LF escaped, and `:` and `,` in properties); `--max-warnings n` exits 1
  above `n` warnings. An unknown `--format` is a usage error, not human output.
- **Rationale:** CI should fail on warnings without re-levelling them in configuration, and show each one
  on the line it concerns.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#cli).

### D-082 — One command name, `kirana-style`

- **Status:** Accepted.
- **Decision:** The command line is the unscoped npm package `kirana-style`, and its binary is
  `kirana-style`, the same name everywhere: `npx kirana-style@latest init` for a first run, then the
  project's own install for every other command. `kirana init` adds `kirana-style` to the dev
  dependencies; `@kirana-style/compiler` no longer declares a binary, and the Rust standalone binary
  is `kirana-style` too. The editor extensions look for `node_modules/.bin/kirana-style` and then
  `kirana`, the 0.1.0 name.
- **Rationale:** npm refuses the unscoped `kirana` as a typosquat of an existing package and will not
  make an exception, so `npx kirana` can never run Kirana. Two names (`kirana-style` for the first
  run, `kirana` after it) taught a command that only worked half the time; one name works in every
  context, and a project that wants a shorter one adds a script.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md#cli).

### D-083 — The runtime merge is cached, and its budget is 1.1 kB

- **Status:** Accepted (2026-10-17). Amends KRN-DYN-005 (1.0 kB to 1.1 kB).
- **Decision:** `sx()` in `@kirana-style/core/internal` keeps the props it merged, keyed by
  `JSON.stringify` of its arguments, and answers the same inputs from that cache with a copy; the
  cache starts over at 4,096 entries. The private runtime's budget becomes 1,100 bytes minified and
  gzipped; with the cache it is 1,075.
- **Rationale:** kirana-lab's large-dom corpus measured Kirana behind StyleX, StyleX (SWC) and Tailwind
  CSS on a table of thousands of rows (filter 1.11–1.25×, heap 1.12–1.26×) with style recalculation
  and layout level or better: the cost was `sx()` merging a component's class string afresh on every
  render. With the cache, in one session on one machine, Kirana ÷ StyleX went to 0.962 on the filter,
  0.977 on rendering every row again and 0.947 on the heap. The 1.0 kB budget was a first plan, not a
  limit anything was measured against; 76 bytes for that is worth it.
- **Trade-off:** 76 bytes in every module that uses the runtime. A faster key (walking the handles)
  was measured and rejected: 146 bytes for no difference a page shows. Splitting the runtime so that
  a module imports only what it uses (147 bytes of `recipe()`) is the way to win room back.
- **Elaborated in:** [09-dynamic-styles](./09-dynamic-styles.md#private-runtime),
  `design-notes/runtime-merge.md`.

### D-084 — Dense names: production renames the hashes after the build

- **Status:** Accepted (2026-10-19), opt-in. Amends D-037: development and production share the
  cascade order and the names' structure, and a dense build differs only in the two hash segments.
- **Decision:** With `names: "dense"` on the Vite or Rolldown host, a production build renames every
  class name the compiler wrote, and the stylesheet.
  - Each 4-character condition hash becomes a code of 1–2 characters, never 3.
  - Each 4-character value hash becomes a code of 1–2 characters from one space shared by every key.
  - The property code and the target segment stay.
  - Codes go to the most used segments first and never change within a session, so the client and the
    SSR build agree.
  - Transforms mark every name they write (`^~`). Chunks are renamed in `renderChunk`, before content
    hashes and with source maps, and only marked names change.
  - A segment past the 3,906 codes keeps its hash.
  - The runtime's condition test accepts any condition segment but a 3-character one.
  - Not available with a class map (D-069).
- **Rationale:**
  - **Size.** The hash segments are most of what a structured name costs; class-names.md measured
    sequential names at about a quarter off the CSS gzip. Renaming after the build avoids what ruled
    them out under D-024: transforms and the development server keep D-037's self-contained names.
  - **Merging.** Keeping the property code and target keeps the runtime merge, and the 400 merge
    vectors replay unchanged in dense names.
  - **Measured on the docs site:**
    - the stylesheet is 12.7 % smaller in gzip and 12.9 % in brotli;
    - the client JavaScript is 1.2–1.4 % smaller;
    - the build takes 4 % longer;
    - computed styles are identical across 41 routes in both schemes, within the site's animation noise.
- **Trade-off:**
  - **Opaque production names.** They cost debugging, which `kirana-style trace` answers in development.
  - **Cache churn.** A name can change between deploys when a new segment outranks an old one, so
    chunks that did not change may get new content hashes. A names manifest that keeps codes across
    builds is the remedy if that shows up in practice.
  - **Runtime size.** 12 bytes of runtime (1,087 of 1,100).
  - **Opt-in for now.** Until kirana-lab measures it across the corpora under the optimiser gate.
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md#hashing-and-names),
  `design-notes/dense-names.md`, `research/compiler-algorithm.md` (P3).

### D-085 — A one-shot build compiles each module once

- **Status:** Accepted (2026-10-19). Amends D-049's premise, not its decision: there is still no
  persistent cache.
- **Decision:** In a one-shot build, a transform of a module whose source, parse mode and naming
  mode are unchanged returns its previous transform.
  - "Unchanged" includes every file its evaluation read, each checked against the hash it had then,
    the export cache's own provenance test.
  - The Vite and Rolldown hosts turn this on at `buildStart`, except in a dev server or a watch build.
  - `invalidate()`, `remove()` and a changed `package.json` drop the reused transforms.
  - The language server and `kirana-style check` never reuse.
- **Rationale:** Vite compiles the same modules for the client and again for the SSR build, and
  D-049's measurement (0.05 s of a 16.2 s build) no longer described the engine at scale.
  - **Profile:** on kirana-lab's scale curve at 1,000 components, the native transform was 581 ms of a
    2.4 s CPU profile, the largest single item.
  - **Measured:** compiling once took the lab's Kirana scale-curve build from 2.40 s to 2.14 s at
    1,000 components and from 13.99 s to 11.38 s at 10,000, the median of three cold builds each.
- **Trade-off:** One stored transform per module for the build's lifetime. It stays off where a file
  created later could change how an import resolves, which provenance does not see, and where memory
  is budgeted: a dev server, a watch build, the language server.
- **Elaborated in:** [10-compiler-architecture](./10-compiler-architecture.md#parallelism-and-cache),
  `research/compiler-algorithm.md` (P2).

### D-086 — A variable token is declared only where something uses it

- **Status:** Accepted (2026-10-19). Amends D-035: the definition still decides how a token compiles,
  but a variable token is declared only when used.
- **Decision:** A Vite or Rolldown production build writes a variable token's declaration, or its
  `@property` registration, only when one of these holds:
  - a rule reads it;
  - the finished bundle (its chunks and other files) still names it;
  - it is declared `runtime: true`, a new option per token or per `defineTokens` group that implies
    `variable: true`.

  A chunk rendered after the stylesheet that names a token the stylesheet left out, as a
  server-only component can, fails the build, naming the token and `runtime: true`. Builds without
  a finished bundle declare every variable token their code names, as before (KRN-TOK-012).

- **Rationale:** A definition module compiles to an object naming every token it defines, so that
  plain code can read them at runtime, and that object kept every token in the stylesheet. Compiled
  components resolve their tokens at build time, so the bundler drops the object, and the tokens
  were declared for nothing.
  - **Lab web app:** 35 of 47 `@property` registrations and 18 `:root` declarations were never read.
  - **This repository's docs site:** 48 token declarations and 35 `@property` rules go; the
    stylesheet is 3.9 % smaller raw, 3.1 % in gzip, 3.4 % in brotli.
  - **Rendering:** computed styles are unchanged across the docs site's 41 routes in both schemes,
    within its animation noise.
- **Trade-off:** A token read only by code the compiler never sees, and absent from the client
  bundle, needs `runtime: true`. The server build reports the case when it renders after the client,
  as in TanStack Start; a host whose server build renders first keeps such tokens anyway, since
  their names reach the bundle before the stylesheet does.
- **Elaborated in:** [07-tokens-themes-presets](./07-tokens-themes-presets.md#inlined-or-variable).

### D-087 — Atoms of one conflict key are ordered to share rules; competition ignores writing mode

- **Status:** Accepted (2026-10-19). Elaborates D-036.
- **Decision:** In `kirana.atoms`, the writer orders the atoms that share a conflict key so that a
  declaration ending one key's atoms starts the next key's, and the two share a rule (KRN-OUT-010).
  The ladder still orders the keys. Whether a rule may move past another to share a declaration is
  decided by what each one sets, whatever the writing mode (KRN-OUT-009):
  - a flow-relative longhand competes with every physical longhand of its group;
  - a box shorthand, and a short list of others whose longhands are complete in their
    specifications, compete with their longhands;
  - legacy aliases compete with what they stand for;
  - other shorthands and vendor-prefixed properties compete with everything.
- **Rationale:**
  - **Same-key atoms never meet.** A merge leaves an element one value per conflict key, so their
    mutual order cannot change a winner. The docs say that joining two compiled class strings by
    hand is undefined.
  - **The old check assumed left-to-right text.** It took a logical longhand's counterpart from
    horizontal, left-to-right writing, so in right-to-left text a `margin-right` rule could move past
    a `margin-inline-start` one and win where the ladder says it loses. It also treated a shorthand
    that Lightning CSS does not split (`text-wrap`, `columns`) as a longhand of its own name.
  - **Measured on Kirana's docs site:** the stylesheet is 0.6 % smaller raw, 0.14 % in
    gzip and 0.37 % in brotli, with 31 fewer rules. Of the merges the research script counted, 4
    remain free of a competing rule in between, worth 85 bytes: the script ignored competitors in
    other at-rule blocks, so its estimate of 2.5 kB on the lab's web app was too high.
  - **Rendering:** computed styles are unchanged on the docs site's 60 routes in both schemes and
    both directions, within its animation noise.
- **Trade-off:** None for output that comes from Kirana's merges. A box shorthand atom can now share
  a rule, which it never did, and a shorthand the writer cannot split still blocks every merge
  across it.
- **Elaborated in:** [13-output-and-performance](./13-output-and-performance.md#output-requirements).

### D-088 — Component states are condition keys, generated from each library's declarations

- **Status:** Accepted (2026-10-21).
- **Decision:** A headless library's part states ship as data in `@kirana-style/states`, one subpath per
  library: `Switch.Root.checked` is `"[data-checked]"`, `Select.Popup.side.bottom` is
  `'[data-side="bottom"]'`. Each entry is a plain string that is already a condition key (KRN-CAS-004),
  generated from the library's own published declarations. Base UI is first (`./base-ui`, from each
  part's `*DataAttributes` module, named by the library's exports). The format is documented, so any
  library or a project's own components can have a vocabulary of a few lines.
- **Rationale:**
  - **Nothing new to learn or compile.** Conditions already take attribute selectors, and computed keys
    already fold from installed packages that depend on core. A state is a condition, so it nests,
    combines with `media()`, reads through relations and goes in recipes, and the compiler's checks
    (`ambiguous-precedence`, exclusivity of one attribute's values) apply unchanged.
  - **Not bound to a component.** A style is not declared for one part, so one handle serves every part
    with that state, and the same mechanism serves any library on any framework.
  - **Generated, so it cannot drift.** Names come from the library's exports and descriptions from its
    own documentation. CI regenerates the file and fails on a difference, and a test checks every
    component and part against the library's runtime exports.
- **Trade-off:** A vocabulary is not checked against the part a style is applied to: a `Switch.Root`
  state on a `Select.Popup` compiles. The selector is still correct CSS, and the name says which part
  it is for.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md), [11-integrations](./11-integrations.md).

### D-089 — Values are checked against mdn-data grammars, rejecting only what the data can judge

- **Status:** Accepted (2026-10-21). Closes deviation 7.
- **Decision:** Every declared value is matched against its property's grammar from `mdn-data`
  (KRN-CAS-010). It is `invalid-value` only when every keyword and function in it is one the data names
  and the grammar still does not fit. A function is matched by name, not by its arguments. A value
  that is one variable token is checked through each value the token declares.
- **Rationale:**
  - **The common mistakes are top-level words.** `padding: red`, `display: center`, `width: -4px` and a
    colour token on a length are all a known word in the wrong place, which the data judges reliably.
  - **Never lagging CSS (P11).** Lightning CSS returns the same untyped tokens for invalid and for newer
    valid syntax, which is why deviation 7 accepted both. Leaving unknown words and functions unjudged,
    and never judging arguments, keeps newer CSS compiling: `calc-size()`, `anchor-center` and a
    keyword newer than the data all pass.
  - **Token domains without an API.** Tokens already carry their values, so checking through them finds
    a colour token on `padding` with nothing to declare.
- **Measured:** no new diagnostic on the golden fixtures (one placeholder value aside), the docs site,
  `packages/ui`, the lab's three apps and its UI package, or kirana-ui.
- **Trade-off:** A mistake inside a function's arguments, or one made with a word the data does not
  know, is not caught.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md#value-normalization).

### D-090 — A build checks R2 only for relations their module keeps to itself

- **Status:** Accepted (2026-10-21). Narrows R2 (08) in a bundler build, as D-062 narrows R1.
- **Decision:** `relation-unused` is reported for a relation its module does not export in every
  build. A relation some module exports is reported only where the project was compiled whole
  (`compile_paths`: `kirana-style check` and the language server).
- **Rationale:** a bundler build compiles only the modules it reaches. A shared component library
  anchors a relation in one component and reads it in another; an application that renders the first
  and not the second (the docs site's theme menu, a `DropdownMenu` without an `Item`) builds the
  anchor with no reader in sight, and the build reported a relation the library reads. An exported
  relation's readers can be anywhere, so only a project compiled whole can say none is. A relation
  kept to its module is read in that module or nowhere, which every build sees.
- **Trade-off:** an exported relation that nothing reads is no longer reported by a bundler build;
  `kirana-style check` and the editor still report it.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-091 — `counterStyle()` is a definition; `@font-face`, `@page` and `@custom-media` stay CSS

- **Status:** Accepted (2026-10-22).
- **Decision:** `counterStyle(descriptors)` is a named definition like `keyframes()` and `positionTry()`:
  a custom ident hashed from the descriptors, an `@counter-style` rule in `kirana.tokens` emitted only
  when referenced (by value, by string, across modules, through `fallback` or `extends`). The
  descriptors are checked: known names, static values, no `var()`, and the symbols the system needs.
  `@font-face`, `@page` and `@custom-media` get no helper; the documentation shows them in a
  stylesheet, and a named media query as a `media()` constant.
- **Rationale:** a counter style written in a global stylesheet has a global name, ships when nothing
  uses it, and a misspelt name in `listStyleType` falls back to `decimal` without a word; the helper
  removes all three, as `keyframes()` does for animations. A browser also drops an unknown descriptor,
  a `var()` in one, and a rule with no symbols, silently (P6). `@font-face` reads font files whose
  `url()` the bundler resolves and fingerprints in a stylesheet, which a value inside a module cannot
  reach, so a helper would be worse than the CSS it replaces. `@page` styles the printed page, not an
  element, and has no name to hash. `@custom-media` is not in browsers yet, and a `media()` condition in
  a constant is already a named, shared query.
- **Measured:** an unused `counterStyle()` emits nothing; the golden fixtures' sizes are unchanged.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md#counterstyle).

### D-092 — Grammar verdicts are remembered

- **Status:** Accepted (2026-10-22). Refines D-089's check (KRN-CAS-010).
- **Decision:** each thread remembers the verdict of every property and value text it has judged, up to
  32,768 pairs, then starts over.
- **Rationale:** matching a value against a long grammar is the most expensive part of a declaration:
  `<color>` alone took 3.1 µs for `#fff`, against 0.09 µs for Lightning CSS to parse the same value.
  Applications repeat values (the zyzz benchmark corpus's 300 components write 1,839 declarations with
  114 distinct pairs), so most checks are repeats. A verdict depends on the two strings alone and a token
  is resolved before the check, so an edited token's new value is a new key, and nothing can go stale.
- **Measured:** the transform of 1,000 styles of eight declarations each went from 33.7 ms to 19.7 ms;
  the grammar check alone from 12.85 ms to 0.89 ms per 8,000 declarations. Stopping the matcher at its
  first full match was considered and left out: with the cache it could save under 0.9 ms of the 19.7,
  against a change to how every grammar is walked.
- **Trade-off:** a few megabytes at most per thread in a long editor session.
- **Elaborated in:** [08-conditions-and-cascade](./08-conditions-and-cascade.md).

### D-093 — `restricted-properties` and `use-logical-properties` are opt-in rules

- **Status:** Accepted (2026-10-22).
- **Decision:** two lint rules a project turns on itself, in neither preset. `restricted-properties`
  reports the properties, or the literal values of a property, the project's options rule out.
  `use-logical-properties` reports a side or corner of the inline axis written physically
  (`marginLeft`) and suggests the logical property; Biome runs it too.
- **Rationale:** both encode a project's own policy. A rule list belongs to the project, and a page that
  is only ever left-to-right loses nothing to physical sides, so neither can be on by default. Only the
  inline axis is reported: top, bottom and sizes change only in vertical writing. The rename is a
  suggestion, never an autofix, because the two properties agree only in left-to-right text. The pairs
  follow the compiler's own `physical_counterpart`, which `mixed-logical-physical` reads.
- **Elaborated in:** [12-tooling-and-dx](./12-tooling-and-dx.md).

### D-094 — A keyframes rule only code names needs the bundle to name it

- **Status:** Accepted (2026-10-23). Extends D-086 from variable tokens to keyframes (KF-021).
- **Decision:** in a finished bundle, a keyframes rule that no rule reads, and that only a module's
  code names (an exported `keyframes()`), is written only when the bundle's chunks or other files still
  name it. The hosts collect `{prefix}f…` names beside `--{prefix}v…`; a later chunk that names one left
  out fails the build, saying to apply it in a style that build compiles.
- **Rationale:** a library's module is compiled whole when any of its exports is imported, so every
  animation it declares reached the stylesheet: kirana-ui imported only scales from
  `@kirana-style/preset-scales` and shipped its eleven keyframes, 1,632 of 35,830 bytes. The bundler
  already drops the unused exports; the stylesheet now follows it, as it does for tokens.
- **Trade-off:** only hosts that report the finished bundle prune (the Rolldown adapter, under Vite
  8 and Rolldown); the others keep every keyframes rule, as they keep every token.
- **Elaborated in:** [06-authoring-api](./06-authoring-api.md).

### D-095 — An argument that can only be a plain object is not a handle

- **Status:** Accepted (2026-10-23). Narrows KRN-DYN-001's open-dynamic handle (KF-010).
- **Decision:** a call to `Object.fromEntries`, `Object.assign`, `Object.create`, `JSON.parse` or
  `structuredClone` (a global, not a binding of the module), or a binding of one, is reported as
  `not-evaluable` where it reaches a `css()` or `cx()` argument or an `sx` value. Anywhere else it stays
  an open-dynamic value.
- **Rationale:** an unreadable argument is merged at runtime, because a handle can be known only then
  (`css(base, props.sx)`), so `css(Object.fromEntries(entries))` compiled to a merge of an object, which
  applies nothing, with no word from the build. Those calls can never return a handle, so they can be
  rejected without rejecting composition.
- **Trade-off:** a helper of the author's own that returns a style object is still taken for a handle;
  the documentation says a style must be written out.
- **Elaborated in:** [09-dynamic-styles](./09-dynamic-styles.md).

## Index by document

| Document                                                      | Decisions                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| the brand notes                                               | D-001                                                                                                                                      |
| [06-authoring-api](./06-authoring-api.md)                     | D-003, D-004, D-006, D-019, D-020, D-035, D-038, D-041, D-043, D-047, D-057, D-058, D-060, D-061, D-074, D-075, D-076, D-088, D-091, D-094 |
| [07-tokens-themes-presets](./07-tokens-themes-presets.md)     | D-005, D-007, D-008, D-009, D-010, D-035, D-047, D-057, D-058, D-059, D-086                                                                |
| [08-conditions-and-cascade](./08-conditions-and-cascade.md)   | D-011, D-012, D-013, D-014, D-015, D-016, D-036, D-038, D-042, D-061, D-062, D-089, D-090, D-092                                           |
| [09-dynamic-styles](./09-dynamic-styles.md)                   | D-017, D-018, D-037, D-043, D-083, D-084, D-095                                                                                            |
| [10-compiler-architecture](./10-compiler-architecture.md)     | D-006, D-021, D-022, D-023, D-024, D-025, D-037, D-039, D-041, D-044, D-045, D-084, D-085                                                  |
| [11-integrations](./11-integrations.md)                       | D-027, D-028, D-029, D-050, D-052, D-053, D-054, D-055, D-065, D-067, D-068, D-069, D-070, D-071, D-072, D-073                             |
| [12-tooling-and-dx](./12-tooling-and-dx.md)                   | D-003, D-030, D-031, D-063, D-064, D-066, D-077, D-078, D-079, D-080, D-081, D-082, D-093                                                  |
| [13-output-and-performance](./13-output-and-performance.md)   | D-020, D-026, D-027, D-036, D-037, D-039, D-044, D-048, D-083, D-087                                                                       |
| [14-benchmark-methodology](./14-benchmark-methodology.md)     | D-032                                                                                                                                      |
| [15-testing-and-conformance](./15-testing-and-conformance.md) | D-032, D-046                                                                                                                               |
| the repository notes                                          | D-029, D-033, D-034, D-040, D-050, D-064                                                                                                   |
| the licensing notes                                           | D-002, D-010, D-025, D-044                                                                                                                 |
| the roadmap                                                   | D-033, D-051, D-056                                                                                                                        |
