# Class maps for server templates

## Summary

A Blade, Twig, ERB, HEEx or Edge template cannot call `css()`, and nothing compiles it. So a server
app keeps its styles in TypeScript modules, `kirana-style build` and `kirana-style dev` write a class map — every
exported handle's class string, by name — and a helper in the template's own language merges the
named strings with the runtime's rules. PHP (Laravel, Symfony), Ruby (Rails), Elixir (Phoenix) and
Node.js (AdonisJS) each have one. The merge needs no Kirana engine in those languages: the rules are
string rules, and the 400 vectors that hold the JavaScript runtime to the build-time merge hold
every port to it too.

## Context <!-- requirements and decisions implemented: D-069, KRN-INT-004 -->

Tailwind CSS supports server frameworks by scanning their templates for class names. Kirana's styles
are typed objects compiled from TypeScript, so a template has nothing to compile. The choices were
to support only these frameworks' JavaScript front ends (Inertia, Hotwire with a bundler), which
leaves the templates — most of a Rails or Phoenix app — unstyled by Kirana, or to give templates the
compiled class strings by name, as CSS Modules does for its consumers.

## Design

- **The file.** `classes: { modules, out }` in `kirana.config` names the modules and the output.
  `Project::class_map` transforms each module (so its atoms are in the stylesheet whatever paths a
  build was given), evaluates its exports with the module host, and flattens them: a handle under
  its export name, a handle inside an exported object under a dotted name (`button.primary`), and
  `export *` sources followed, the module's own names shadowing them. Tokens, keyframes, relations,
  functions and plain values are left out; a recipe, an array or a runtime value is
  `classes-not-static` (KRN1904).

  ```json
  {
    "version": 1,
    "prefix": "k",
    "families": { "four": 45, "two": 111 },
    "classes": { "button.primary": "k3_aaaa …", "card": "…" }
  }
  ```

  `families` are the two property-code bounds the runtime compiles in (`FOUR`, `TWO`, from
  `kirana_css_data`), so no helper hard-codes them.

- **The merge.** A class is `{prefix}{key}_{value}`. The helpers port the runtime's `add()`
  (`npm/core/src/internal.ts`): the last class per key wins, `…_` and `…*_` tombstones remove one
  key or every condition of a property, a box shorthand removes its longhands (whose codes follow
  its own), and `{shorthand}/{codes}…_` unfolds earlier shorthand atoms into longhands in place.
  Classes without the prefix (markers) pass through, first-applied order kept. The element gets the
  merge without tombstones. Each port is about 80 lines.
- **The helpers.** Each reads the class map, merges, and fails loudly on an unknown name:
  - `helpers/php` (`kirana-style/kirana`): `ClassMap`, `Merge`; a Laravel service provider registering the
    `@kirana(…)` Blade directive (discovered through `extra.laravel`), and a Twig extension for
    Symfony that reads the file on first use.
  - `helpers/ruby` (`kirana`): the same two classes and a Railtie that puts the `kirana` view helper
    in every view; the map is read again when its modification time changes.
  - `helpers/elixir` (`kirana`): `Kirana.kirana/1` for HEEx, the map cached in `:persistent_term`
    by modification time and size.
  - `@kirana-style/core/class-map` and `@kirana-style/adonis`: Node.js merges with the runtime itself, and the
    AdonisJS provider registers `kirana()` as an Edge global.
- **The editor.** `kirana_frontend::templates` finds the string literals and Ruby symbols passed to
  `kirana` in a template. The language server builds a module that imports each name's first segment
  from the class-map module exporting it (`Project::class_names`) and appends one `sx` binding per
  name on its literal, so hover, colours and summaries work as in components. A name nothing
  exports is `unknown-class-name` (KRN1905).
- **The stylesheet** goes where the framework serves static files (`public/kirana`,
  `priv/static/kirana` for Phoenix), written by `kirana-style dev` beside the server and `kirana-style build` in
  the deploy.

## Findings

- **The merge rule holds, at 80 lines rather than 15.** The plan's first estimate counted only the
  last-wins rule; box families and shorthand unfolding make up most of the port. Every port passes
  all 400 vectors.
- **The vectors caught an ordering difference.** Setting an existing key in a JavaScript `Map`
  keeps its position; PHP arrays and Ruby hashes do the same, but the Elixir port, which keeps an
  insertion counter per key, first moved a re-set marker to the end (`km-dark` after `ktQ9x0Z`).
  `put/3` now keeps an existing key's order, as the others do.
- **High property codes are outside the vectors.** The vectors' properties have short codes, so no
  vector reaches a two-character longhand code or an upper-case one. The helpers' tests add four
  cases from the runtime (`kE_`, `k1j_`, `k1x_`) that do.
- **Symfony warms Twig before the first build.** `composer install` runs `cache:clear`, which
  builds Twig's extensions; an extension given a `ClassMap` read the file then and failed. The
  extension takes the file's path and reads it on first use.
- **PHP branch coverage is not measurable with Xdebug here.** Line and method coverage are 100 %;
  Xdebug's path coverage reports branches unhit that the tests demonstrably run (the Blade
  directive's closure, the unfold loop), so the PHP gate is lines and methods.

## Verification

- `helpers/php`: PHPUnit (409 tests, the vectors included), 100 % lines and methods.
- `helpers/ruby`: Minitest with SimpleCov, 100 % lines and branches, a Rails app rendering the helper.
- `helpers/elixir`: ExUnit, 100 % (`test_coverage: [summary: [threshold: 100]]`).
- `npm/core/test/class-map.test.ts`, `npm/adonis/test/adonis.test.ts`; Rust tests in
  `kirana_project/tests/classes.rs`, `kirana_cli/tests/cli.rs`, `kirana_frontend/tests/templates.rs`
  and `kirana_lsp/tests/templates.rs`.
- `examples/laravel`, `symfony`, `rails`, `phoenix` and `adonisjs`: built, served, the probe checked
  in Chromium, and on the dev server an edit to the style module reaching the page on reload.

## Costs

- **Every exported style is in the stylesheet**, used by a template or not: no template is read at
  build time.
- **A merge happens on every helper call**, in the server's language, over a handful of classes.
- **Four ports of the merge** to keep in step with the runtime; the shared vectors make a drift fail
  the build of the port that drifted.
