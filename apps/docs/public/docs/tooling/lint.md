# Lint
Source: https://kirana.style/docs/tooling/lint

# Lint

`@kirana-style/eslint-plugin` reports what the compiler knows, where the code is
written, in the linter you already run.

Other styling lint plugins re-implement CSS validation in JavaScript, and drift from
the compiler they check. Kirana's rules read the compiler itself — the diagnostics,
the atoms each style compiles to, every token, how imports resolve — so lint and
build never disagree, and the plugin is mostly about the mistakes no compiler can
see: an override that silently loses, a forwarded `sx` in the wrong place, a class
that never reaches the DOM.

<!-- ::figure-lint -->

## Pick your linter

- [Oxlint](/docs/tooling/lint#oxlint) — jsPlugins
- [ESLint](/docs/tooling/lint#eslint) — Flat config
- [Biome](/docs/tooling/lint#biome) — GritQL plugins


Under Oxlint and ESLint the rules are the same objects, and so are their results —
the same reports at the same places, and the same fixed text. A test runs every
rule through both linters on each change. Biome cannot run JavaScript rules, so
it gets the four that need no compiler, rewritten as GritQL plugins.

### Oxlint

Through Oxlint's JavaScript plugins, at Oxlint's speed:

```jsonc
// .oxlintrc.json
{
  "jsPlugins": [
    { "name": "kirana", "specifier": "@kirana-style/eslint-plugin" },
  ],
  "rules": {
    "kirana/diagnostics": "error",
    "kirana/sx-last": "error",
    "kirana/no-conflicting-props": "error",
    "kirana/override-keeps-conditions": "error",
    "kirana/no-classname-on-sx": "error",
    "kirana/no-dark-variant": "warn",
    "kirana/no-unused": "warn",
  },
}
```

### ESLint

Flat config:

```js
// eslint.config.js
import kirana from "@kirana-style/eslint-plugin"

export default [kirana.configs.recommended]
```

### Biome

`@kirana-style/biome-plugin` carries `sx-last`, `no-conflicting-props`,
`no-dark-variant` and `no-class-helpers` as [GritQL plugins](https://biomejs.dev/linter/plugins/):

```jsonc
// biome.json
{
  "extends": ["@kirana-style/biome-plugin/recommended"], // or /strict
}
```


A test runs each of them through Biome and through its ESLint original, and the
reports — line, column and message — must match. Each message starts with the
rule's name, since Biome files every plugin diagnostic under `plugin`. The
presets name the rules as `./node_modules/@kirana-style/biome-plugin/rules/*.grit`,
because Biome resolves a plugin path from the project; in a workspace member
whose `node_modules` sits higher up, list the files from there in `plugins`.

A Biome plugin matches syntax: it cannot ask the compiler or read another file.
What the other rules would report reaches a Biome project two other ways —
`kirana check` in CI, as pull-request annotations, and the
[language server](/docs/tooling/editor) in the editor:

```yaml
# .github/workflows/ci.yml
- run: npx kirana check src --format github --max-warnings 0
```


`no-unused` and `sort-properties` stay ESLint and Oxlint only: counting member
reads and ordering keys against the property table are beyond what GritQL can
express.

## The project root

The project root is the nearest `kirana.config.*` above the file being linted. In a
monorepo whose packages share a configuration, give the package its own
`kirana.config.ts` that exports it, or set `settings.kirana.root`. The project is
compiled once per lint run and each file once, however many rules ask; the native
engine must be installed, as for a build.

## Every rule at a glance

- [`kirana/diagnostics`](/docs/tooling/lint#diagnostics) (recommended) — Every compiler diagnostic, at the property
- [`kirana/sx-last`](/docs/tooling/lint#sx-last) (recommended, autofix, also Biome) — A forwarded sx that callers cannot override
- [`kirana/no-conflicting-props`](/docs/tooling/lint#no-conflicting-props) (recommended, also Biome) — className or style beside a styleProps() spread
- [`kirana/override-keeps-conditions`](/docs/tooling/lint#override-keeps-conditions) (recommended, suggestions) — A plain override that loses under [data-*]
- [`kirana/no-classname-on-sx`](/docs/tooling/lint#no-classname-on-sx) (recommended) — A class that never reaches the DOM
- [`kirana/no-unused`](/docs/tooling/lint#no-unused) (recommended, suggestions) — Styles and recipe options nothing applies
- [`kirana/no-dark-variant`](/docs/tooling/lint#no-dark-variant) (recommended, also Biome) — Dark mode the page's chosen mode never reaches
- [`kirana/sort-properties`](/docs/tooling/lint#sort-properties) (strict, autofix) — Property and condition order
- [`kirana/prefer-token`](/docs/tooling/lint#prefer-token) (strict, suggestions) — A literal that repeats a token
- [`kirana/finite-bridge`](/docs/tooling/lint#finite-bridge) (strict) — A runtime value that is really a variant
- [`kirana/no-class-helpers`](/docs/tooling/lint#no-class-helpers) (strict, also Biome) — clsx, tailwind-merge or cva joining class strings

## Configs

- **`recommended`** — the problems: what the build reports, and what loses a style
  without any error. `diagnostics`, `sx-last`, `no-conflicting-props`,
  `override-keeps-conditions`, `no-classname-on-sx`, `no-dark-variant`,
  `no-unused`.
- **`strict`** — adds the stylistic and advisory rules: `sort-properties`,
  `prefer-token`, `finite-bridge`, `no-class-helpers`.

Biome's presets have the same names and hold the rules it can run.

## Rules

### `diagnostics`

Every [compiler diagnostic](/docs/tooling/diagnostics), at the property it is
about, so a CI that only lints still fails on what the build would report.
Warnings and errors by default; `{ "minimum": "info" }` adds the informational ones
and `{ "ignore": ["unresolved-import"] }` drops names.

### `sx-last`

A component that forwards its caller's `sx` must put it last, or the styles after
it override the caller's — and the caller cannot tell why their style does not
apply. Autofix.

```tsx
<div sx={[styles.root, sx, active && styles.active]} /> // ✕
<div sx={[styles.root, active && styles.active, sx]} /> // ✓
```

A `className` handed down by a parent's `render` may follow it.

### `no-conflicting-props`

`className` or `style` written next to `{...styleProps(…)}` on one element: JSX
keeps the last one, so either the compiled styles or the attribute never reach
the DOM. Move those styles into a `css()` handle passed to `styleProps()`.

### `override-keeps-conditions`

The pitfall of coming from StyleX: StyleX replaced a whole property, Kirana
[merges per condition](/docs/styling/merging). A plain value passed to a component
that sets the same property under an attribute condition keeps losing there:

```tsx
// Separator: alignSelf: { base: "stretch", '[data-orientation="vertical"]': "center" }
<Separator sx={css({ alignSelf: "auto" })} /> // ✕ still "center" when vertical
```

Two suggestions: set the value under the component's conditions too, or
`{ "*": null, base: "auto" }` to drop the component's entries. Interaction states
(`:hover`) are not reported — keeping a component's hover over your plain value is
usually what you want.

### `no-classname-on-sx`

`className` given to one of your components that takes `sx` and not `className`:
the class never reaches the DOM. A component that spreads the rest of its props
may pass it on, so it is not reported.

### `no-unused`

A style nothing applies: a key of a module-local styles object that no
`styles.<key>` reads, or a recipe option no call selects and no default names.
Exported objects and ones used whole are left alone, and so are Vue, Svelte and
Astro files, whose templates the linter does not see. Suggestion: remove it.

### `no-dark-variant`

Dark mode written the way other systems write it, which compiles without complaint
and which the page then ignores. A `prefers-color-scheme` condition in a style — a
key of a `css()` or `recipe()` object, or a `media()` query — follows the
operating system, not the mode the page chose, so a theme toggle that sets
`color-scheme` never reaches it. A Tailwind `dark:` class left in a `className`,
`class` or `sx` string names a class no stylesheet defines. Put both values in a
`light-dark()` [token](/docs/tokens/themes-and-modes), which follows
`color-scheme`. A `matchMedia()` call outside a style is left alone. Also under
Biome.

```tsx
css({
  color: { base: "black", "@media (prefers-color-scheme: dark)": "white" },
}) // ✕
css({ color: color.foreground }) // ✓ light-dark(black, white)
```

### `sort-properties`

In `strict`. One order in every style object: layout, box, typography, visual, the rest, custom
properties, then nested blocks. A conditional value goes `base`, then at-rules,
relations, pseudo-classes and attributes — weakest to strongest, the order the
ladder applies them — so the source reads in cascade order. Order never changes
what Kirana compiles, so the fix is always safe; an object with a spread is left
alone. Autofix.

### `prefer-token`

In `strict`. A literal equal to a token's value (`color: "#0af"` where `color.brand` is
`#0af`) suggests the token, with its import, so a theme or a design change reaches
it.

### `finite-bridge`

In `strict`. A style factory whose value is bridged at runtime — `(size) => css({ width: size })`
— but only ever called with a few literals is a variant in disguise. A recipe
variant compiles to static classes; the bridge costs a custom property and a
`style` attribute on every element.

### `no-class-helpers`

In `strict`. An import of `clsx`, `classnames`, `tailwind-merge` or
`class-variance-authority`. Joined class strings do not merge: two atoms for one
property both apply, and which wins depends on the stylesheet, not on the order
written. `cx` and `sx={[a, b]}` [merge per property](/docs/styling/merging), and
[`recipe()`](/docs/styling/recipes) compiles the variants `cva` would pick at
runtime. Also under Biome.

## This repository

The docs and demo apps lint themselves with `recommended`. Its first run found 19
ties the UI configuration had already declared impossible but that a tool run
inside `packages/ui` could not see, three real precedence ties, a shorthand that
could not be split, and 21 unused styles.
