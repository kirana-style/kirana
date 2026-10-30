---
title: Configuration reference
description: Every key that exists today, with its type, default and what it changes.
kind: config
section: reference
order: 2
keywords:
  [
    configuration reference,
    targets,
    layers,
    prefix,
    branchBudget,
    diagnostics,
    exclusive,
    classes,
    externals,
  ]
---

# Configuration reference

Every key there is, and what each one changes.

## `layers`

```ts
layers: { before?: string[], after?: string[], tiers?: boolean }   // default: { before: [], after: [], tiers: false }
```

Layer names placed around Kirana's own layer, for your global CSS. Each must be a
valid CSS identifier, and none may be `kirana`. `tiers` puts each step of the
precedence ladder in a sub-layer of `kirana.atoms`. See
[layers](/docs/config/layers).

## `targets`

```ts
targets: { chrome?: number | string, safari?: number | string, firefox?: number | string }
```

Browser versions to compile for, as a major number (`123`) or `"major.minor"`
(`"17.5"`). The default floor is **{{fact:browser-floor}}**.

Setting a target below the floor makes Lightning CSS lower the output where it
can, and emits `target-lowering` (informational) so you know it happened. A minor
above 255, or a value that is not a number, is `invalid-config`.

## `names.prefix`

```ts
names: { prefix?: string }   // default: "k"
```

The prefix on every generated class and custom property. One to four lowercase
ASCII letters. Give two independently built applications different prefixes and
they can share a page without colliding.

## `dynamic.branchBudget`

```ts
dynamic: { branchBudget?: number }   // default: 16
```

How many branches a class expression may have before the compiler stops and
reports `branch-budget-exceeded`. Must be at least 1. See
[values known at runtime](/docs/styling/dynamic).

## `jsx`

```ts
jsx: "preact" // "react" | "preact" | "solid" | "qwik"
```

Which attribute `sx` compiles to. Leave it out and the compiler reads
`compilerOptions.jsxImportSource` from the project's `tsconfig.json`, so most
projects never set it:

| Value      | `sx` compiles to | Read when `jsxImportSource` is |
| ---------- | ---------------- | ------------------------------ |
| `"react"`  | `className`      | anything not below             |
| `"preact"` | `class`          | `"preact"`                     |
| `"solid"`  | `class`          | `"solid-js"`, `"solid-js/h"`   |
| `"qwik"`   | `class`          | `"@qwik.dev/core"`             |

See [supported frameworks](/docs/frameworks/overview).

## `libraries`

```ts
libraries: ["@acme/design-system"] // default: []
```

Installed packages whose styles this app compiles as it compiles its own. A
published Kirana library ships its `css()` calls uncompiled; listing it here puts
its styles in your stylesheet, deduplicated with yours and under your prefix,
targets and layers. Leave a library out and its first `css()` throws with a message
naming this key. Kirana's own scales preset is compiled without being listed. See
[publishing a library](/docs/building/libraries).

## `presets`

```ts
import scales from "@kirana-style/preset-scales/preset"

presets: [scales()] // default: []
```

Presets contribute data to the configuration: today, a utility grammar that
turns on [utility strings](/docs/styling/utilities). A preset is
`{ name: string, utilities?: UtilityGrammar }`; later presets replace earlier ones
scale by scale, root by root, variant by variant and handle by handle.

## `utilities`

```ts
utilities: {
  scales: { color: [{ module: "./src/theme.ts", export: "theme" }] },
  utilities: { stack: [{ static: { display: "flex", flexDirection: "column" } }] },
  variants: {
    selected: '[aria-selected="true"]',
    dark: { module: "./src/styles/mode.ts", export: "DARK" },
  },
  handles: { "scroll-fade": { module: "./src/styles/scroll-fade.styles.ts", export: "scrollFade" } },
}
```

The application's own grammar, merged after every preset. It has four parts:

| Part        | What it holds                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scales`    | Where a scale's values come from: exports of modules, looked up as an `import` would be (relative modules from the project root), searched in order. |
| `utilities` | What each root sets, as rules tried in order.                                                                                                        |
| `variants`  | A name for any condition `css()` accepts, or the export holding one; a condition starting with `::` is a pseudo-element block.                       |
| `handles`   | A utility name for a style handle the design system exports, applied whole.                                                                          |

An export is `{ module, export, path? }`, read as an `import` would read
`export` and then each key of `path`. A variant written as one is the design
system's own condition:

- `kirana-style migrate tailwind` writes it as a computed key, imported:
  `[breakpoint.md]`, `[DARK]`;
- a utility string uses the condition it holds;
- the scales preset declares its breakpoints and container queries this way, and
  a project with its own breakpoints names its own export under the same variant;
- the export may be a condition, a key string, or a relation's condition, which
  only the codemod can write: a string key cannot hold a relation.

A handle is a utility the design system already has as a `css()` handle:

- the codemod imports it and puts it first in the element's `sx` array:
  `sx={[scrollFade, styles.list]}`;
- a utility string applies it before its own declarations;
- it applies whole, so under a variant, negated or with `!` it is reported;
- a utility that only sets declarations needs no handle: it is a `static` rule.

A rule is one of three kinds:

| Rule                     | For                                   |
| ------------------------ | ------------------------------------- |
| `{ static: {…} }`        | the root alone: `flex` sets `display` |
| `{ properties, scale }`  | values from a scale, or a number      |
| `{ properties, values }` | values from a fixed table of keywords |

A scale rule takes these options:

| Option      | What it does                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `number`    | `{ step, unit }`: a number that is not a key, as `w-50` is 50 × `0.25rem`. A rule may have `number` and no `scale`.                                                                                         |
| `pair`      | Properties set from other scales at the same key: `text-sm` also sets its line height. A utility that sets that property itself (`text-sm leading-6`) wins, and a modifier (`text-sm/relaxed`) replaces it. |
| `alpha`     | A colour: `/90` mixes it with `transparent`.                                                                                                                                                                |
| `negative`  | `-mt-2` negates the value.                                                                                                                                                                                  |
| `fractions` | `w-1/2` is a percentage.                                                                                                                                                                                    |
| `format`    | The value inside other text: `brightness({value})`.                                                                                                                                                         |
| `aliases`   | Utility keys spelled differently from the scale's: `in-out` reads `inOut`.                                                                                                                                  |
| `also`      | Declarations set alongside, as written (a keyword rule takes it too).                                                                                                                                       |

In any text of a rule, `{scale.key}` is that token, and a property written
`{scale.key}` sets the token's custom property. That is how a ring and a shadow
share one `box-shadow`: its value is `"{compose.ring-shadow}, {compose.shadow}"`,
and each utility sets one of the two.

## `diagnostics`

```ts
diagnostics: Record<string, "off" | "info" | "warning" | "error">
```

Re-level a diagnostic by its kebab-case name:

```ts
diagnostics: {
  "sx-on-external-component": "error",   // stricter
  "dynamic-bridged": "off",              // quieter
}
```

**Errors cannot be re-levelled.** An error means the output would be wrong, so
turning it into a warning would only hide a broken build. Trying is
`invalid-config`, as is naming a diagnostic that does not exist. The
[diagnostics reference](/docs/tooling/diagnostics) lists which ones can move.

## `conditions.exclusive`

```ts
conditions: { exclusive?: string[][] }   // default: []
```

Groups of conditions that a library guarantees never hold together on one
element. Each group needs at least two entries, and each entry must be exactly one
attribute or pseudo-class selector.

```ts
conditions: {
  exclusive: [
    ["[data-starting-style]", "[data-ending-style]"],
    ["[data-open]", "[data-closed]"],
  ],
}
```

This is how you silence `ambiguous-precedence` for pairs the selectors cannot
prove are exclusive. The compiler already knows about two values of one attribute,
a selector and its negation, and fixed positions counted from the same end; you
only need to declare what a library promises.

## `conditions.exclusiveAcross`

```ts
conditions: { exclusiveAcross?: string[][] }   // default: []
```

One vocabulary per library a design system writes its components for: two
conditions that no vocabulary holds together are exclusive, since a component is
built on one library. At least two vocabularies, each entry exactly one attribute
or pseudo-class selector. `exclusiveAcross()` from `@kirana-style/states` builds
them from the library vocabularies; see
[one look for several libraries](/docs/styling/states#one-look-for-several-libraries).

## `conditions.ownAttributes`

```ts
conditions: { ownAttributes?: string[] }   // default: []
```

Attributes your own components write, by name (`"data-side"`), whatever library
they are built on. A vocabulary may name one too, as Base UI does for its popups'
side, but on your component the attribute is yours: `exclusiveAcross` keeps nothing
apart by it, so a sheet's side nested in React Aria's entering state is emitted
rather than left out. Two values of the attribute still never meet. To claim one
for a single component, leaving it to the vocabulary elsewhere, use
[`own()`](/docs/reference/api#own-attributes) in that component's style.

## `classes`

```ts
classes: { modules: ["resources/styles"], out: "public/kirana/classes.json" }
```

The class map for server templates. `modules` are files or folders, relative to
the root, whose exported handles Blade, Twig, ERB, HEEx and Edge templates name.
The build and dev commands write their class strings to `out`, and compile the
modules whatever paths they were given. A recipe or a runtime value among the
exports is `classes-not-static`. See [server templates](/docs/frameworks/server-templates).

## `externals`

```ts
externals: ["meteor/"] // default: []
```

Specifier prefixes the bundler provides and Node.js resolution cannot find. An
import from one is a runtime value, as an installed package's is, instead of an
`unresolved-import` warning.

Who sets them:

- the Ember adapter adds Ember's own: `@ember/`, `@glimmer/`, `@embroider/virtual/`;
- [Meteor](/docs/frameworks/meteor) sets `meteor/`;
- [Docusaurus](/docs/frameworks/docusaurus) sets its webpack aliases, such as
  `@theme/` and `@docusaurus/`.

## `ui`

```ts
ui: { framework: "react", iconLibrary: "lucide" } // default: none
```

The component registry's settings, read by [`kirana-style ui`](/docs/tooling/cli#kirana-style-ui)
(`@kirana-style/registry`) and never by the compiler, which accepts the key and
leaves it out of every compile.

```ts
ui: {
  registries: {
    "@acme": "https://acme.dev/r/{name}.json",
    "@private": {
      url: "https://private.dev/r/{name}.json",
      headers: { Authorization: "Bearer ${PRIVATE_TOKEN}" },
    },
    "@local": "public/r/{name}.json",
  },
}
```

`registries` names registries by namespace:

- each is a template holding `{name}`: a URL, a path from the configuration's
  folder, or a `file:` URL;
- a header may read an environment variable as `${NAME}`. One that is not set
  stops the command, and a header's value is never printed;
- `@kirana`, Kirana UI's registry, is known without being named, and can be
  renamed to point elsewhere.

What `kirana-style ui add` installs, and where:

| Key           | Holds                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `framework`   | whose markup to install: `react`, `vue`, `svelte`, `solid` or `angular`; by default the one whose package your project depends on |
| `base`        | which base's markup, such as `base` or `aria`; by default the only one an item has                                                |
| `aliases`     | the import specifier for each file type, `ui`, `lib`, `component`, `hook` and `page`                                              |
| `iconLibrary` | the library icons are drawn with: `lucide` (the default), `tabler`, `hugeicons`, `phosphor` or `remixicon`                        |
| `design`      | the design system's values your project uses, such as `{ style: "vega" }`, which `kirana-style ui preset` writes                  |

The aliases default to shadcn/ui's:

```ts
aliases: { ui: "@/components/ui", lib: "@/lib", component: "@/components", hook: "@/hooks" }
```

A file is written in the directory your `tsconfig.json`'s paths map its alias to:
with `"@/*": ["./src/*"]`, the ui files go to `src/components/ui`.

The settings are checked before anything is fetched.

## `root`

Set by the adapter, not by you: the project root, which scopes a build and makes
diagnostic paths relative.
