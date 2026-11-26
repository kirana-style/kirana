---
title: Kirana 0.4
summary: Shorter class names in production, a given className that wins over sx, codemods from styled-components and CSS Modules, kirana-style ui on more frameworks, and three releases in three weeks.
date: 2026-11-26
author: Kirana team
tags: [announcement, release]
---

Kirana 0.4 has been on npm since 6 November, and 0.4.2 is its newest release.
Every package is released at the same version, so update all the Kirana packages
your project lists together, then run:

```console
$ npx kirana-style@latest doctor
```

`doctor` reads your project and says when its Kirana packages are not all on one
release. This post covers the whole 0.4 line: the two changes that can alter
what a build gives you, what is new, and how the three releases went.

## Breaking: production builds write dense class names

A class name carries two hashes, one for its condition and one for its value.
A production build now replaces both with codes of one or two characters,
numbered across the whole application, so `k50-KFHz_D9ur` ships as something like
`k50-b_a`. Variable tokens and keyframes that only the stylesheet names get
short names the same way.

Merging works exactly as before, and nothing extra ships to the browser. What it
saves depends on the application: in the latest run of
[the benchmarks](/docs/building/output#dense-names), against hashed names, the
CSS in gzip came out {{fact:bench-dense-css}} and what a page downloads
{{fact:bench-dense-bytes}}.

What can notice the change:

- **Anything that reads class names from a production build,** such as an
  end-to-end test or a snapshot. The development server, the language server
  and `kirana-style trace` keep the hashed names.
- **Caching between deploys.** The shortest codes go to the most used values, so
  a change elsewhere in the application can renumber them, and a chunk whose
  source did not change may still be downloaded again.

Either way, `names: "hashed"` in the plugin's options keeps the old names. A
project with a [class map](/docs/frameworks/server-templates) for server
templates keeps them on its own. The
[Vite guide](/docs/integrations/vite#dense-names) has the details.

## Breaking: a given className wins over an element's own sx

When an element has both its own `sx` and a `className` handed to it, the two
were always merged. The given class now merges last, as a caller's `sx` would,
so where both set the same property, the given class wins:

```tsx
<div {...props} sx={styles.root} />
// props.className, from a render prop or a parent, wins over styles.root
```

This is what a headless library's render prop expects: the outer part's classes
win over the rendered component's own, as they do in shadcn/ui. If one of your
components relied on its own `sx` winning, put that style last in an `sx` array
instead. [The sx prop](/docs/styling/sx) has the rule.

## Moving an existing project over

Two codemods rewrite an existing codebase into Kirana styles, one for
styled-components (and Emotion) and one for CSS Modules. Each prints its diff and
a report first, and applies it with `--write`:

```console
$ npx kirana-style migrate styled-components src
$ npx kirana-style migrate css-modules src --write
```

The report names what a codemod cannot decide for you, such as CSS whose result
depended on which file loaded first. The guides walk through
what changes, from
[styled-components](/docs/migration/from-styled-components) and from
[CSS Modules](/docs/migration/from-css-modules).

## Components on more frameworks

`kirana-style ui`, the command that installs components from a registry into your
project, now installs on Svelte, Solid and Angular. Along the 0.4 line it also
learned to:

- **start a new app from a registry's template:**
  `npx @kirana-style/registry init --template vite-react my-app`;
- **work in a monorepo,** with the components in a package every app imports, as
  shadcn/ui's monorepo template has them;
- **build a registry from your own sources** with `ui build`;
- **serve your registries to an AI assistant** with `ui mcp`, so it can search
  them, read an item and get the command that installs it
  ([registries for AI assistants](/docs/tooling/mcp)).

[Installing components](/docs/tooling/components) covers all of it.

## Typed states for more libraries

`@kirana-style/states` turns a headless library's data attributes into typed
condition keys. 0.4 adds vocabularies for ui-sdk and for Kirana UI Primitives,
and follows each of their releases, so a part's states are a type check away
instead of a string you type by hand. The
[component states](/docs/styling/states) guide lists every library.

## Smaller things worth knowing

- **Solid 2** is supported: `sx` is typed on `@solidjs/web`, `init` detects it,
  and there is a template for it ([Solid guide](/docs/frameworks/solid#solid-2)).
- **Desktop and mobile apps** have guides, on Electron, Tauri, Electrobun and
  Capacitor ([desktop and mobile](/docs/frameworks/desktop)).
- **A hover on a large style** shows its first rules and conditional values and
  counts the rest, so the card stays readable.
- **Faster builds and edits.** A build hands the engine many modules in one
  call, a large module's compile time grows in step with its styles, an
  unchanged module is answered before it is read again, and styles
  that read tokens compile once per session.

## How 0.4 came together

- **0.4.0, 6 November:** dense names, the className rule, both codemods, and
  `kirana-style ui` on Svelte, Solid and Angular with `ui build` and `ui mcp`.
- **0.4.1, 9 November:** apps from a registry's template, components in a
  monorepo, and `ui init` setting up React Router, Nuxt and SvelteKit.
- **0.4.2, 20 November:** Solid 2, the ui-sdk and Kirana UI Primitives
  vocabularies, and fixes for what the first projects on 0.4 ran into.

Every change, with its pull request, is in [the changelog](/changelog).
