# 00 — Glossary

**Owns:** the meaning of every term used across this specification.
**Depends on:** nothing.

Every other document uses these words exactly as defined here. When a document needs a term that is
not listed, add it here first.

## Product and scope

| Term                  | Definition                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kirana**            | The product: a compile-time styling system made of a Rust compiler, a small authoring API, host adapters, presets, and developer tooling. Working name; see the brand notes.                  |
| **Engine**            | The Rust compiler core (`kirana_*` crates). It holds styling semantics and knows nothing about bundlers, frameworks, or design vocabularies.                                                  |
| **Preset**            | An opt-in package of data — tokens, named conditions, and (later) a utility grammar — that the engine consumes. The engine ships no preset.                                                   |
| **Host**              | A program that drives the engine: a bundler (Vite, Rolldown, Rspack, webpack, esbuild, Bun), the CLI, the language server, or a test runner.                                                  |
| **Driver**            | The JavaScript-side orchestration layer shared by every Node/Bun/Deno host: loads configuration, discovers files, feeds the engine, and returns CSS and diagnostics. It never owns semantics. |
| **Host adapter**      | A thin per-host package that maps one host's plugin API onto the Driver. It never owns semantics.                                                                                             |
| **Feasibility phase** | The period in which Kirana is developed as local packages inside this monorepo before any public release. See the roadmap.                                                                    |

## Authoring

| Term                | Definition                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Style**           | One object passed to `css()`: CSS properties, optionally nested under conditions.                                                                               |
| **Style handle**    | The opaque value `css()` returns. It can be passed to `sx`, to `cx()`, or composed into another style. At runtime it is a class string plus optional variables. |
| **Recipe**          | A component styling definition with `base`, `variants`, `compoundVariants`, `defaultVariants`, and optional `slots`, created with `recipe()`.                   |
| **Slot**            | A named part of a multi-element recipe (for example `root`, `label`, `icon`).                                                                                   |
| **`sx` prop**       | The compiler-recognised prop that applies style handles. On host elements it compiles to `class`/`style`; on components it is an ordinary prop.                 |
| **Utility surface** | The deferred authoring form in which styles are written as class-like strings (`"px-4 hover:bg-primary"`) parsed by a preset grammar.                           |
| **Codemod**         | A one-shot source migration (`kirana-style migrate stylex`, `kirana-style migrate tailwind`) that rewrites existing code into Kirana authoring.                 |

## Tokens and theming

| Term                | Definition                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Token**           | A named design value defined with `defineTokens()`. It has a type (color, length, number, duration, string) and a value, possibly per mode.     |
| **Primitive token** | A token holding a raw scale value (a palette step, a spacing step).                                                                             |
| **Semantic token**  | A token whose value refers to other tokens and expresses intent (`surface.page`, `text.muted`).                                                 |
| **Inlined token**   | A token the compiler writes into CSS as its literal value because nothing can change it at runtime.                                             |
| **Variable token**  | A token the compiler emits as a CSS custom property because a theme, a mode, a scoped override, or the author requires it to change at runtime. |
| **Mode**            | A value set selected by `color-scheme` (`light`, `dark`) and resolved with `light-dark()`.                                                      |
| **Theme**           | A scoped set of variable-token overrides applied to a subtree.                                                                                  |

## Conditions and cascade

| Term                          | Definition                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Condition**                 | A context under which a declaration applies: a pseudo-class, an attribute, an at-rule query (`@media`, `@container`, `@supports`), or a relation.               |
| **Relation**                  | A declared link between two elements, created with `relation()`, used to style one element by the state of another (the role of Tailwind's `group-*`/`peer-*`). |
| **Relation anchor**           | The element that carries a relation's marker class.                                                                                                             |
| **Contextual style**          | A style an ancestor applies to matching descendants (the role of Tailwind's `[&_svg]:…`). Always lower precedence than the descendant's own styles.             |
| **Precedence ladder**         | The single, global, documented ordering that decides which of two matching atoms wins. Defined in [08-conditions-and-cascade](./08-conditions-and-cascade.md).  |
| **Cascade layer**             | A CSS `@layer`. Every rule Kirana emits sits in a named layer under the `kirana` root layer.                                                                    |
| **Longhand expansion**        | Rewriting a shorthand declaration (`padding`, `border`) into its longhands in the Style IR so merging is always per longhand.                                   |
| **Omitted key**               | A property or condition that does not appear in a style. It leaves any earlier value in the merge untouched.                                                    |
| **Explicit removal (`null`)** | A property or condition set to `null`. It removes an earlier value in the merge.                                                                                |

## Compilation

| Term                         | Definition                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Style-bearing module**     | A source module that contains at least one Kirana entry point (`css`, `recipe`, `cx`, `defineTokens`, `relation`, `keyframes`, or an `sx` attribute). Only these are parsed. |
| **Prefilter**                | The byte-level scan that decides whether a module might be style-bearing before any parse.                                                                                   |
| **Source frontend**          | The part of the engine that turns one source language (TS/JS/JSX, or the script and markup parts of Vue/Svelte/Astro) into Oxc ASTs with original spans.                     |
| **Restricted evaluator**     | The engine's constant folder: it computes values from a closed subset of JavaScript and never executes user code.                                                            |
| **Pure-function descriptor** | A closed, owned representation of a small side-effect-free function that the restricted evaluator can apply at build time.                                                   |
| **Style IR**                 | The single intermediate representation between source frontends and CSS backends. Defined in [10-compiler-architecture](./10-compiler-architecture.md).                      |
| **Atom**                     | One Style IR rule identity: one longhand property, one normalized value, one ordered condition set. Atoms are deduplicated project-wide.                                     |
| **Static**                   | A style value the evaluator fully resolves at build time.                                                                                                                    |
| **Finite dynamic**           | A value chosen at runtime among alternatives that are all resolvable at build time (`cond ? a : b`).                                                                         |
| **Open dynamic**             | A value only known at runtime (`props.width`). Compiled through the CSS-variable bridge.                                                                                     |
| **CSS-variable bridge**      | The mechanism that emits a static rule reading a custom property and assigns that property from runtime code.                                                                |
| **Branch budget**            | The maximum number of alternatives a finite-dynamic site may expand to before the compiler reports it instead of rewriting it.                                               |
| **Private runtime**          | The only runtime code Kirana ships: a class merger, a bridge helper and a recipe resolver. It has no public API and never injects CSS.                                       |
| **Diagnostic**               | A structured compiler message with a stable code `KRN####`, severity, spans, explanation, and optional fixes.                                                                |

## Evidence labels

| Label          | Meaning                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **FACT**       | Confirmed by a primary source: official documentation, an official or local repository at a named commit, or a measured file. |
| **INFERENCE**  | Engineering reasoning derived from facts.                                                                                     |
| **HYPOTHESIS** | A product or performance assumption. Every hypothesis names the experiment in the roadmap that tests it.                      |
