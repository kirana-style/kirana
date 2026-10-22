---
name: kirana
description: Write, fix and review styles in a project that uses Kirana, the compile-time styling system (@kirana-style/core, css(), recipe(), sx). Use whenever a codebase imports @kirana-style/core or has a kirana.config file and you are styling components, adding tokens or themes, reading a KRN diagnostic, or a style compiles but renders wrong. Kirana is newer than most training data, so do not write Tailwind, StyleX, Panda, cn() or class-variance-authority habits into it.
---

# Kirana

Kirana compiles typed style objects written next to components into atomic class names and one
static stylesheet. Nothing styles at runtime. It is **not** Tailwind, StyleX or Panda, though it
borrows from all three:

- Styles are `css({ ... })` handles from `@kirana-style/core`. There is no `cn`, no
  `class-variance-authority`, no utility-class strings by default, and no `dark:` variant.
- Elements and your own components take **`sx`**, never `className`: `<div sx={[styles.card, sx]} />`.
  The compiler turns `sx` into `className`, merged with the element's own.
- Every colour is a `light-dark(<light>, <dark>)` pair; `color-scheme` on `<html>` picks the half.

## The rules that cause real bugs

1. **Conditions go inside the value.** `color: { base: "black", ":hover": "blue" }`, never a
   top-level `":hover": { ... }` key (`unknown-condition`). At-rules too:
   `fontSize: { base: "1rem", [media("(min-width: 48rem)")]: "1.25rem" }`.
2. **A later style replaces the entries it names, not the whole property.** `sx={[a, b]}` merges per
   property _and_ condition. A caller's `alignSelf: "auto"` replaces the base entry and keeps the
   component's `'[data-orientation="vertical"]'` one. To win there too, write it under that condition,
   or clear the property first: `{ "*": null, base: "auto" }`. Omitting a key keeps it; `null` removes
   it.
3. **A component takes `sx?: Sx` and forwards it last:** `sx={[styles.root, sx]}`. Take `sx` out of a
   rest spread: `({ sx, ...props })`, or nothing compiles it (`unused-sx`).
4. **Components from installed packages do not read `sx`** (Base UI, Radix, any `node_modules`
   component). Spread compiled props instead:
   `import { props as styleProps } from "@kirana-style/core"` then `<Menu.Popup {...styleProps(styles.popup, sx)} />`.
   Do not also write `className` or `style` on that element.
5. **Dark mode lives in tokens.** Give a colour token both values as a `light-dark()` pair, and switch
   modes with `mode.light` / `mode.dark` / `mode.system` on the root element. A
   `prefers-color-scheme` condition ignores the mode the page chose.
6. **Prefer a finite set over a runtime value.** `tone === "danger" ? styles.danger : styles.calm` or a
   `recipe()` variant compiles to static classes. A value only known at runtime
   (`(w) => css({ width: w })`) becomes a custom property and an inline `style` (`dynamic-bridged`);
   keep that for continuous values.
7. **Everything in a style is static.** Keys, spreads and token values must be known at build time;
   imports must resolve. The compiler reports what it cannot evaluate instead of guessing.
8. **Name the longhands you set** and prefer logical properties (`paddingInline`, `marginBlockStart`).
   A font size goes with its line height.

## The loop

Run the CLI through the project's package manager (`npx kirana-style …`, `bunx kirana-style …`); the
command is `kirana-style`, never a bare `kirana` (npm does not give out that name). Exit code 1 means
an error diagnostic, 2 a bad configuration or argument.

0. **Setting a project up:** `npx kirana-style@latest init --dry-run` prints every change as a diff
   (the adapter, the config, the stylesheet import) without writing; run it without `--dry-run` once
   the user agrees, and `--install` only when they want the install run for them. Then
   `kirana-style doctor`.
1. **Learn the project first.** `kirana-style export` prints the design system as JSON: every token with
   its value and file, themes, recipes with their variants and options, relations, keyframes,
   `positionTry`, `viewTransition` and `counterStyle` names. Use the tokens and recipes that exist instead of
   inventing values. `kirana-style doctor` says whether the engine, packages and wiring are right.
2. **Write the style** with the API below. Look up a signature in `references/api.md`.
3. **Check it.** `kirana-style check src` prints every diagnostic as `severity[KRN1234] name: message`,
   with the location and a `help:` line; `--format json` gives you
   `{ code, name, severity, file, span, message, help }` to act on, and `--max-warnings 0` fails on
   any warning. Fix every error; `references/diagnostics.md` explains each code. Do not silence a
   warning by re-levelling it in config unless the user agrees.
4. **Lint.** If the project has `@kirana-style/eslint-plugin` (ESLint or Oxlint) or
   `@kirana-style/biome-plugin` (Biome), run its linter; `references/lint.md` lists the rules.
5. **When it compiles but looks wrong:** `kirana-style trace src/card.tsx:12 padding` prints every
   candidate value for that property at that line, the winner, and the precedence step that decided
   it. Give it the line the style is on; the property may be `paddingTop` or `padding-top`. It
   answers from the compiled result, so trust it over reading the source. Then compare **computed
   styles** in the browser, not screenshots, in both colour schemes.
6. **After a refactor, or before adding a token:** `kirana-style analyze src` reports the stylesheet by
   layer, the most reused atoms, what each module costs, values bridged to runtime, and tokens
   nothing reads (`--json` for all of it). Delete the dead tokens; a bridged value that could be a
   finite set is a candidate for rule 6.
7. **When it looks like a Kirana bug:** `kirana-style doctor --report` writes `kirana-report.md`, a redacted
   issue body (versions, environment, diagnostics by code, configuration; no source text, no paths
   or user names). Add `--trace file:line property` for the trace. Ask the user before filing it.

## Where new things go

| You need                                   | Write                                                                                                                                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styles for a component                     | `const styles = { root: css({...}), title: css({...}) }` after the imports, named by part                                                                                                    |
| Variants (size, tone) and slots            | `recipe({ base, variants, compoundVariants, defaultVariants, slots? })`; static calls compile to class strings                                                                               |
| A design value used twice                  | `defineTokens("space", { 4: "1rem" })`; colours as `light-dark()` pairs                                                                                                                      |
| A token a theme or a subtree overrides     | `defineTokens(ns, values, { variable: true })`, then `defineTheme(tokens, overrides)`                                                                                                        |
| Style by a parent's or sibling's state     | `const field = relation("field")`, `sx={field.anchor}` on it, `{ [field.within(":focus-within")]: ... }` on the reader                                                                       |
| Style children from a parent               | `[select.descendant("svg")]: { ... }`; it ranks below the child's own styles                                                                                                                 |
| A media, container or supports query       | `[media("(min-width: 48rem)")]`, `[container("(min-width: 20rem)", "card")]`, `[supports("display: grid")]` inside the value                                                                 |
| An animation                               | `const spin = keyframes({ to: { rotate: "1turn" } })`, then `animationName: spin`                                                                                                            |
| A value with a fallback for older browsers | `minHeight: firstThatWorks("100dvh", "100vh")`, preferred first                                                                                                                              |
| Anchor-positioning fallbacks               | `const below = positionTry({ positionArea: "bottom" })`, then `positionTryFallbacks: \`${below}, flip-block\``                                                                               |
| View-transition styles                     | `const slide = viewTransition({ old: {...}, new: {...} })`, applied as `sx={slide}` and passed as the class name to the framework's transition API; you set `viewTransitionName` per element |
| List markers and counters                  | `const check = counterStyle({ system: "cyclic", symbols: '"✓"' })`, then `listStyleType: check` or `` content: `counter(step, ${check})` ``; `@font-face` and `@page` stay in a stylesheet   |

In a bundler project the adapter compiles the styles: do not add `kirana-style build` or `dev` there.
Those two are for server templates and projects with no bundler.

`references/frameworks.md` has how `sx` is spelled in each framework (Vue `:sx`, Angular `[sx]`,
Ember's `sx` helper, server templates' `kirana(...)` helpers) and which package installs it.

## What not to write

| Habit from elsewhere                                                 | In Kirana                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `className={cn("px-4", isActive && "bg-primary")}`                   | `sx={[styles.item, isActive && styles.active]}`                      |
| `cva(...)`                                                           | `recipe(...)`                                                        |
| `dark:bg-zinc-900`, `.dark &`, `@media (prefers-color-scheme: dark)` | a `light-dark()` colour token                                        |
| `":hover": { color: "blue" }` at the top level                       | `color: { base: ..., ":hover": "blue" }`                             |
| `!important`                                                         | a condition, or `{ "*": null, base: v }`; check `kirana-style trace` |
| `stylex.create`, `stylex.props`                                      | `css`, `sx` (or `styleProps` for installed components)               |
| `style={{ ... }}` for static values                                  | `css({ ... })`                                                       |
| `[&:not([class*='size-'])]` guards                                   | `select` blocks already rank below the child's own styles            |

## More

Kirana's documentation is written for agents too: `https://kirana.style/llms.txt` is the index (one
line per page), and every page has a markdown twin at `https://kirana.style/docs/<path>.md`. Start
with `start/mental-model.md`, `styling/merging.md`, `styling/precedence.md` and
`reference/api.md`. For moving a codebase from Tailwind or StyleX, use the `kirana-migrate` skill.
