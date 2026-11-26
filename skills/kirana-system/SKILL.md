---
name: kirana-system
description: Build, publish and maintain a design system on Kirana (@kirana-style/core): token layers, themes, recipes and relations; an npm library apps compile (libraries in kirana.config); a component registry installed with kirana-style ui (registry.json, ui build, ui validate, design-system items, preset codes, bases per framework, templates); and keeping installed copies current (ui outdated, ui diff, ui update). Use when creating, restructuring or publishing a design system or component library on Kirana, writing registry items, or adding a framework, base, axis, preset or template to one. For styling inside one app, use the kirana skill.
---

# Design systems on Kirana

Kirana is a compiler, not a design system. A design system on it is modules of tokens, recipes and
components that each app compiles with its own styles. Read the `kirana` skill first: its rules
hold in every module here. This skill adds what changes once other projects consume your styles.

There are two ways to ship one, and they differ in what the consumer owns:

|              | An npm library                                 | A registry                                                               |
| ------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| What ships   | source modules, their `css()` calls uncompiled | static JSON: each item's files with their content and hash               |
| The consumer | lists the package in `libraries`               | runs `kirana-style ui init` and `ui add`; the files become the project's |
| Overriding   | `sx` on your components, property by property  | editing the installed files; `ui update` keeps the edits                 |
| Frameworks   | what your package is written for               | style modules once, markup per framework and base, in one item           |
| Updates      | a new package version                          | a version per item: `ui outdated`, `ui diff`, `ui update`                |

## What a design system is made of

The docs name six layers. Give each its own modules, so a new value has one home:

| Layer          | Holds                                                                        | Written with                                                               |
| -------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 · Scales     | palette, spacing, type ramp, radii, durations; inlined, free when unread     | `defineTokens("space", {...})`, or `@kirana-style/preset-scales`           |
| 2 · Semantic   | what the scales mean (`background`, `primary`, `border`); themes override it | `defineTokens("theme", {...}, { variable: true })`, colours `light-dark()` |
| 3 · Conditions | shared relations, context tokens a parent hands down, keyframes              | `relation()`, a variable token used as a key, `keyframes()`                |
| 4 · Recipes    | each component's variants, and shared chrome (focus ring, overlay surface)   | `recipe({ base, variants, compoundVariants, defaultVariants, slots })`     |
| 5 · Primitives | thin elements (`Box`, `Stack`, `Text`) carrying the system's defaults        | components taking `sx`                                                     |
| 6 · Components | the real parts, each taking `sx` last                                        | `sx={[styles.root, sx]}`                                                   |

Themes are `defineTheme(tokens, overrides)` handles on a subtree; the mode is `mode.system`,
`mode.light` or `mode.dark` on `<html>`. Every token kind, with an example each, is in
`references/tokens.md`.

## The rules that cause real bugs

1. **A colour is one `light-dark()` pair, in a variable group.** `color-scheme` on `<html>` picks the
   half, so one declaration covers both schemes and the halves cannot drift. A value that differs by
   mode and is not a colour (a filter, a shadow's strength) is `{ light, dark }`. There is no dark
   variant to add.
2. **Make the semantic layer variable and keep scales inlined.** Only a variable token can be
   themed: `defineTheme` on an inlined one is the error `token-not-variable`. A theme that changes a
   scale step moves every layout that uses it; theme the meaning (`theme.primary`), not `space[4]`.
3. **One namespace per token group in a package.** A second `defineTokens("theme", ...)` is
   `token-namespace-collision`. A group named like one of `@kirana-style/preset-scales`' (`space`,
   `radius`) compiles apart but reads alike, and `check` says so (`token-namespace-shared`).
4. **A parent hands a value down through a variable token used as a key** (`[ctx.iconSize]: "0.875rem"`
   on the parent, `width: ctx.iconSize` on the icon), never through a class name a child hopes to
   read: neither side needs the other's class names.
5. **One style module per part, for every base.** Item style modules are written once for every
   framework; only the markup is per base. Write each headless library's state key side by side
   (Base UI's `[Popover.Popup.startingStyle]` beside React Aria's `[Popover.entering]`), and give the
   configuration `conditions: conditionsOf(baseUi, reactAria)`: those keys never meet on one element,
   but without it two different values under them are `ambiguous-precedence`. A key two libraries
   spell alike (`[data-disabled]`) is one key: write it once.
6. **Ship the configuration your styles need, as an export.** A library's modules and a registry's
   installed files compile with the app's configuration (its prefix, targets, layers and
   conditions), never yours. Export the object (`layers`, `conditions`) and have the app spread it:
   a registry names it in the design system's `setup.config`, and `ui init` spreads it into
   `kirana.config.ts`.
7. **A library ships source, never compiled CSS.** Build it without Kirana's plugin so the `css()`
   calls stay in the published JavaScript, and make `@kirana-style/core` a peer dependency. A library
   compiled on its own bakes its compiler version and configuration into its class names: with
   another prefix an app's override no longer replaces its value, and with an older compiler the
   same declaration ships twice. An app that does not list the package in `libraries` gets an error
   from its first `css()`.
8. **Append to a preset layout, never insert or reorder.** A preset code is a base-62 number holding
   one index into each field's `values`, from bit 0. Insert a value and every published code means
   something else. Add a value at the end of its list, a field at the end of its layout, and give a
   field the bits for the values it will grow to: an index past the list reads as its first value.
9. **Bump an item's `version` whenever its files change.** `ui outdated` and `ui update` refuse a
   registry that changed an item's files under the same version.
10. **Name an icon once for every library, in a base's files.** `<IconPlaceholder lucide=… tabler=…
    hugeicons=… phosphor=… remixicon=… />` becomes the project's own icon at install, and an install
    whose library it does not name fails. Keep the placeholder module itself as a file of an item
    (the design system's): `ui build` refuses an import that no item provides. A file every framework
    installs (`styles`, `files`) cannot draw icons.
11. **Let `ui build` write the documents.** It writes each file's content and hash; a hand-edited
    file whose hash no longer matches fails `ui validate`, and so fails every install.

## What the checks do not catch

`ui build` and `ui validate` prove each document's shape, its hashes, a font item's package, an
axis's items, and that every `defaultBase` and `requires` names a base an item has. They do not
prove that a flattened build renders what the module as written does for that value: `ui build`
copies `flattened` as you wrote it and reads no source for it, so compare computed styles in the
browser before you publish one. `ui validate` reads items, indexes and lockfiles; it reads
`templates/index.json` as an item and fails, so give that file its `$schema` for your editor and try
each template with `init --template`. And `kirana-style check` passing says a token exists, not that
both its halves are the colours meant: read them in `kirana-style export`.

## The loops

Run the CLI through the project's package manager (`npx kirana-style …`). The registry commands
come from `@kirana-style/registry`, a development dependency; `npx @kirana-style/registry <command>`
runs the same commands where no project has it yet.

**Build or change the system**

1. `kirana-style export` lists every token with both halves of a pair, each theme and what it
   overrides, recipes with their variants, relations with where they are anchored and read, each
   with its file and line (`--definitions` adds what each exported style evaluates to). Extend what
   exists instead of adding a near duplicate.
2. Write it layer by layer, scales up to components.
3. `kirana-style check src --format json` until it is clean; the `kirana` skill's diagnostics
   reference explains each code.
4. `kirana-style analyze src` reports variable tokens nothing reads, each theme with the tokens it
   overrides, values bridged to runtime, recipes resolved at runtime and relation reads no anchor
   proves. Delete the dead, and turn a bridged value with known options into a variant.
5. Compare computed styles in the browser, in both schemes and under each theme.
6. `kirana-style export src --out design-system.json`, committed: it is sorted, so a review sees
   what a change did to the system.

**Publish a library**

1. Build the package with `tsc`, `tsdown` or any bundler, without Kirana's plugin, and ship no CSS.
   Apply styles with `props(styles.root, sx)`, which compiles in plain JavaScript; `sx` on elements
   needs JSX, so ship `.tsx` or `.jsx` to keep it.
2. `@kirana-style/core` in `peerDependencies`; export the tokens apps may use, and the
   configuration of rule 6.
3. In a test app, install the packed tarball (`npm pack`), add `libraries: ["@acme/ui"]` to its
   `kirana.config.ts` (with Next.js, the package in `transpilePackages` too), and run
   `kirana-style check` and the app's build. Vite needs nothing more.

**Publish a registry** (shapes and every command in `references/registry.md`)

1. Write `registry.json`: each item with its `styles`, its shared `files`, and its markup under
   `frameworks.<framework>.<base>.files`, each file by the path it is read from. Name a design
   system item (`type: "design-system"`) with its `setup` and `design`; `ui init` installs the first
   one in the index.
2. `npx kirana-style ui build` (or `ui build registry.json --out dist/r`) writes one document per
   item and `index.json`, or prints every problem and writes nothing (exit 1).
3. `npx kirana-style ui validate public/r/button.json public/r/index.json`, in your registry's CI too.
4. Install it as a consumer would before you host it. In a test app:
   `npx kirana-style ui init --registry @acme=../acme/public/r/{name}.json --dry-run` (add
   `--preset <code>` to check a layout), then `npx kirana-style ui add @acme/button --dry-run`, then
   both without `--dry-run`, and build the app. `ui search` and `ui view @acme/button` show what
   your index and items say.
5. Host the folder as static files; a project names it in `ui.registries` with a `{name}` template.
6. Templates: pack each archive with your own build (`ui build` writes none), list them in
   `templates/index.json` beside the index, and try each with
   `npx @kirana-style/registry init --template @acme/<name> my-app --registry @acme=<template>`
   (`--dry-run` cannot start from a template).

**Keep installed copies current**

Change a file, bump the item's `version`, `ui build`, `ui validate`, publish. In each consuming
project: `npx kirana-style ui outdated` lists items whose registry has a new version or changed
files (exit 1 when one does), `ui diff [item]` shows the lines between the project's file and what
installing it now would write, and `ui update [item] --dry-run`, then without it, writes the
registry's changes and keeps the project's. A file both sides changed stops `update` until someone
reads `ui diff`; `--overwrite` takes the registry's. A file a formatter only reformatted is not a
change.

## Where things go

| You need                                     | Write                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A scale value                                | the scales module, inlined                                                                                 |
| A colour that changes with the scheme        | the semantic group, `{ variable: true }`, as a `light-dark()` pair                                         |
| A non-colour value per mode                  | `{ light, dark }` in a variable group                                                                      |
| A brand or a section's look                  | `defineTheme(theme, overrides)`, applied as `sx` on the subtree                                            |
| The page's mode                              | `mode.system` on `<html>`; in a registry, the design system's `setup.document` export                      |
| A value a parent hands to its children       | a variable token in the conditions layer, set as a key, read as a value                                    |
| A group or peer state components share       | `relation(name)` in one module; `{ optional: true }` when the anchor's component may not be installed      |
| A component's variants                       | `recipe()` in the component's style module                                                                 |
| A headless library's state                   | its typed key from `@kirana-style/states/<library>`, one module for every base, `conditionsOf` in config   |
| What every consumer's config needs           | an exported object: the design system's `setup.config`, or spread by the library's users                   |
| A reset or `@font-face`                      | a stylesheet in a layer before Kirana's, named in `setup.stylesheets`                                      |
| A font a design picks                        | a `font` item per family, named by its axis's `items`                                                      |
| A design choice (style, radius, base colour) | an axis in the design system's `design.axes`, an attribute on `<html>`, and a preset layout                |
| Markup for another framework or library      | another base under `frameworks.<framework>`, and its default in the index's `defaultBase`                  |
| A base on another major of its framework     | the index's `requires` (`{ "solid": { "uisdk": "solid2" } }`), and `bases/<framework>-<base>/package.json` |

## What not to write

| Habit from elsewhere                                    | On Kirana                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| a compiled `dist/styles.css` in the library's package   | the `css()` calls left in the JavaScript; apps list it in `libraries` |
| a `.dark` block repeating every colour                  | one `light-dark()` pair per semantic token                            |
| a theme that overrides `space[4]`                       | a theme over the semantic layer                                       |
| one style module per headless library for one part      | one module, each library's key side by side, `conditionsOf` in config |
| a new preset value inserted mid-list                    | appended at the end of the field's `values`                           |
| changed files republished under the same item version   | a new `version` on the item                                           |
| `content` and `hash` edited by hand in a published item | `ui build` from the sources                                           |
| an icon imported from one icon library in a component   | `<IconPlaceholder>` naming all five                                   |
| `diagnostics: { "ambiguous-precedence": "off" }`        | `conditions: conditionsOf(...)`, or nest the winning condition        |

## More

Kirana UI (`https://ui.kirana.style`, the `@kirana` registry every project knows without naming it)
is a registry built this way at scale: shadcn/ui's design system, its style modules compiled for
React, Vue, Svelte, Solid and Angular, its markup on several headless libraries. `npx kirana-style
ui view <item> --json` prints any of its items as read. The full pages:
https://kirana.style/docs/building/design-system.md, https://kirana.style/docs/building/libraries.md,
`tooling/registries.md`, `tooling/components.md`, `tokens/semantic-tokens.md`,
`tokens/themes-and-modes.md` and `styling/states.md`. For writing styles in an app, use the `kirana`
skill; for moving a codebase to Kirana, `kirana-migrate`.
