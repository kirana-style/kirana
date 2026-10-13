# Vue, Svelte and Astro: compiling `sx` in single-file components (2026-09-23)

KRN-INT-004 lists Vue, Svelte and Astro as P1 with "SFC masking adapter" as the source handling.
This note settles what that adapter is before three of them are built. It is M4 phase 5.

## The problem

The engine compiles TypeScript and JSX (Oxc). A `.vue`, `.svelte` or `.astro` file is neither: it is
a script block in TypeScript or JavaScript plus a template in the framework's own syntax. Two things
in it concern Kirana:

1. **The script** declares styles: `const card = css({ … })`. These must compile exactly as in a
   `.ts` file — that is where the atoms, the class names and every diagnostic come from.
2. **The template** applies them: `<div :sx="[card, wide && full]">` (Vue),
   `<div sx={[card, wide && full]}>` (Svelte, Astro). This must become the class and style the
   framework renders.

## Options considered

**A. Compile after the framework.** Let the framework compile the file to JavaScript and run the
engine on the result. The script part works, but the template has become render-function calls
(`_createElementVNode("div", { sx: … })`), different for every framework and every version of it;
recognising `sx` there means depending on each compiler's private output. Rejected.

**B. A virtual TSX module per component** (the original "masking" idea): turn the script plus every
template binding into one TSX module, compile it, and write each piece back to its position. It would
let the static path turn `sx={card}` into a literal `class`, as JSX gets. But a template expression is
evaluated in the framework's scope (Vue's `_ctx`, Svelte's runes, `{#each}` bindings, Astro's
`Astro.props`), which TSX cannot express faithfully; a binding that references an `{#each}` item or
a slot prop has no TSX equivalent. The saving is one runtime merge per element, which is cheap.
Rejected for now; recorded as the upgrade path if that merge ever shows in a profile.

**C. Compile the script, rewrite the bindings** (chosen). Before the framework sees the file:

- The script block — Vue's `<script>` and `<script setup>`, Svelte's instance and module scripts,
  Astro's frontmatter — is compiled by the engine as a module of its own, under the component's path
  plus the block's language (`Card.vue.setup.ts`), and its compiled text replaces the block's.
  Imports resolve from the component's directory, so tokens and relations work as in any module.
- Each `sx` binding in the template becomes a spread of the private runtime's `sx()`, created with
  the `class` attribute: Vue `v-bind="__kirana_sfc.sx([…], [], [])"`; Svelte and Astro
  `{...__kirana_attrs([…], [class], style)}`. The runtime merges the handles exactly as it does for
  dynamic `sx` in JSX (same function, same tombstones), so the output classes are the ones JSX
  would produce.
- The runtime import (and, for Svelte and Astro, a four-line helper) is added to the script the
  template can see: Vue's `<script setup>`, Svelte's instance script, Astro's frontmatter — created
  when the component has none.

Each framework's own parser finds the blocks and bindings (`vue/compiler-sfc`, `svelte/compiler`,
`@astrojs/compiler-rs` or `@astrojs/compiler`), loaded from the application, which has it installed already: Kirana does not
parse template syntax itself, and a framework upgrade that changes its syntax changes its parser.

## Per framework

|                            | Vue                                                                                | Svelte                                                                                           | Astro          |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| Binding                    | `:sx="expr"` (`v-bind:sx`)                                                         | `sx={expr}`                                                                                      | `sx={expr}`    |
| Becomes                    | `v-bind="__kirana_sfc.sx([expr], [], [])"`                                         | `{...__kirana_attrs([expr], [class], style)}`                                                    | same as Svelte |
| Existing `class` / `style` | left in place: Vue merges `class` and `style` from `v-bind` with the element's own | folded into the call and removed: a spread and an attribute would otherwise overwrite each other | as Svelte      |
| `style` of dynamic values  | object (Vue accepts it)                                                            | string: Svelte's spread sets `style` as text                                                     | string         |
| Runtime goes into          | `<script setup>`                                                                   | instance `<script>`                                                                              | frontmatter    |

The helper for Svelte and Astro turns the runtime's style object into a declaration string and joins
it with the element's own `style` text.

## What this does not do

- **`css()` inside a template expression** is not compiled — only scripts are. It throws at runtime
  with the "not compiled" message, which is loud. Declare styles in the script, as the examples do.
- **Static class literals.** Every `sx` binding merges at runtime (option B would remove that).
- **Diagnostics about the element** (`sx` on a component that drops it, relation placement) are not
  reported for template bindings; script diagnostics are.
- **Source maps** map the edited file to the original at the granularity of the edits (MagicString,
  high resolution); the compiled script block's own map is not composed into it.

## Hosts

Vite covers all three (Vue with `@vitejs/plugin-vue` and Nuxt, Svelte and SvelteKit, Astro).

- **At `load`, not `transform`.** The adapter compiles a component in its `load` hook, as the file is
  read, so every framework plugin's `transform` receives the rewritten source whatever order the
  plugins run in. A `transform` was tried first and failed on Astro: its plugin compiles `.astro`
  files ahead of every user plugin, so Kirana only ever saw Astro's JavaScript output. The
  framework's own requests for a component's parts (`Card.vue?vue&type=style…`) are left alone.
- **Astro's parser.** Astro 7 parses with `@astrojs/compiler-rs`, an Oxc tree with UTF-16 offsets on
  every node; Astro 5 and 6 with the Go `@astrojs/compiler`, whose attributes carry only a start
  offset and are located against the source (a mismatch is an error, never a guess). A component
  without a frontmatter still gets an empty frontmatter node from compiler-rs, at 0–0.
- **Astro's stylesheet.** Astro inlines small stylesheets into its pages and links larger ones by
  names it records before `generateBundle`. The adapter therefore fills the stylesheet first
  (`generateBundle` with `order: "pre"`, before Astro reads CSS), and `@kirana-style/astro` — the
  integration Astro users install — keeps the name and renames the file by its real content after
  Astro has written every page (`astro:build:done`).
- **Identity.** The engine knows each block as its own module (`Card.vue.setup.ts`); the Driver maps
  a change to `Card.vue` onto its blocks, and a block reported by an invalidation back onto the
  component, so HMR and token edits work as for any module.

## Verification

Golden tests per framework (input component, expected output), the three examples (`vite-vue`,
`vite-svelte`, `astro`) built from the packed tarballs and checked in a browser, and 100 % coverage
of the masking module.
