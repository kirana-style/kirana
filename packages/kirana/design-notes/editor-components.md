# Vue, Svelte and Astro in the language server (2026-10-05)

The build compiles components through the Driver's masking (`sfc-masking.md`): each framework's
own parser finds the script blocks and the `sx` bindings. The language server is Rust, runs on
its own thread over stdio, and cannot load those parsers. This note records how it reads
components instead, and the evidence that it reads them as the build does.

## What the server needs

The same two things the build needs: each **script block** (to compile it under the same module
id, so tokens, relations and diagnostics agree), and each **template binding** (to show what the
element receives). It does not need the template's structure, only where each binding's
expression is.

## Options

**A. Call into JavaScript for the parse.** `kirana lsp` usually runs in Node (the `.bin` shim),
so the server could ask the Driver. But the server is synchronous and also runs from the Rust
binary with no Node at all; Zed and Helix start it either way. Rejected.

**B. A scanner in Rust (chosen).** Blocks and bindings sit at well-defined places: top-level
`<script>` tags (Vue, Svelte), Astro's leading `---` fence, and attributes named `:sx`,
`v-bind:sx` (Vue) or `sx` with a braced value or the `{sx}` shorthand (Svelte, Astro). Finding
them needs a tag lexer that skips comments, raw-text elements, quoted values, braces, strings,
template literals and — in Astro — markup nested inside expressions. It never parses JavaScript.

## The evidence

`npm/compiler/test/sfc-scan.test.ts` runs the scanner (through `scanComponent` in the Node
binding) and the frameworks' parsers (`parseComponent` in `sfc.ts`) over every component in
`examples/` and fifteen constructs — `v-pre`, nested `<template>`, `v-for`, `{#each}`, snippets,
`<svelte:element>`, `context="module"`, `.map()` with JSX, ternaries of elements, shorthand and
spread attributes, empty expressions, non-ASCII text — and requires identical blocks, binding
spans and expressions. Its first run failed on one case: Vue decodes character references in a
directive (`:sx="x + &quot;y&quot;"` compiles `x + "y"`). The scanner now decodes them and keeps
an offset map back to the source (`Binding::shifts`). Any new disagreement becomes a construct in
that test.

## Template bindings as sites

The block the template sees (Vue `<script setup>`, Svelte's instance script, Astro's frontmatter)
is compiled with one `<div sx={expression} />` per binding appended, parsed as TSX whatever the
block's `lang` (`Project::transform_jsx`). Each binding becomes a site like any JSX `sx`, so every
feature works unchanged; `component.rs` maps spans back. Diagnostics inside the appended JSX are
dropped: an `{#each}` item or a slot prop is unresolved there by design, and the build reports
nothing for templates either.

## Limits

- A block that does not parse as TSX (`<T>x` assertions in `lang="ts"`) compiles alone: its
  diagnostics and features remain, its template gets no hints.
- Svelte: handles declared only in `<script module>` are not visible to the appended bindings.
- Vue Options API components have no `<script setup>` for the template, so bindings get no hints,
  as the build itself creates that block only at compile time.
