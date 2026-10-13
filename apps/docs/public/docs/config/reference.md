# Configuration reference
Source: https://kirana.style/docs/config/reference

# Configuration reference

Every key there is, and what each one changes.

## `layers`

```ts
layers: { before?: string[], after?: string[] }   // default: { before: [], after: [] }
```

Layer names placed around Kirana's own layer, for your global CSS. Each must be a
valid CSS identifier, and none may be `kirana`. See [layers](/docs/config/layers).

## `targets`

```ts
targets: { chrome?: number | string, safari?: number | string, firefox?: number | string }
```

Browser versions to compile for, as a major number (`123`) or `"major.minor"`
(`"17.5"`). The default floor is **Chrome 123, Safari 17.5, Firefox 120**.

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

Which attribute `sx` compiles to: `className` for `"react"`, `class` for
`"preact"`, `"solid"` and `"qwik"`. Leave it out and the compiler reads
`compilerOptions.jsxImportSource` from the project's `tsconfig.json` —
`"preact"` means Preact, `"solid-js"` means Solid, `"@qwik.dev/core"` means Qwik,
anything else React — so most projects never set it. See [supported frameworks](/docs/frameworks/overview).

## `libraries`

```ts
libraries: ["@acme/design-system"] // default: []
```

Installed packages whose styles this app compiles as it compiles its own. A
published Kirana library ships its `css()` calls uncompiled; listing it here puts
its styles in your stylesheet, deduplicated with yours and under your prefix,
targets and layers. Leave a library out and its first `css()` throws with a message
naming this key. See [publishing a library](/docs/advanced/libraries).

## `presets`

```ts
import scales from "@kirana-style/preset-scales/preset"

presets: [scales()] // default: []
```

Presets contribute data to the configuration — today, a utility grammar that
turns on [utility strings](/docs/styling/utilities). A preset is
`{ name: string, utilities?: UtilityGrammar }`; later presets replace earlier ones
scale by scale, root by root and variant by variant.

## `utilities`

```ts
utilities: {
  scales: { color: [{ module: "./src/theme.ts", export: "theme" }] },
  utilities: { stack: [{ static: { display: "flex", flexDirection: "column" } }] },
  variants: { selected: '[aria-selected="true"]' },
}
```

The application's own grammar, merged after every preset.

- `scales` — where a scale's values come from: exports of modules, looked up as
  an `import` would be (relative modules from the project root). Several sources
  are searched in order.
- `utilities` — what each root sets, as rules tried in order: `{ static: {…} }`
  for fixed declarations; `{ properties, scale }` for a scale, with optional
  `number` (`{ step, unit }`: a bare number that is not a key, as `w-50` is 50 ×
  `0.25rem`; a rule may have `number` and no `scale`), `negative`, `fractions`,
  `alpha` (colour opacity), `pair` (a second property from another scale, as
  `text-sm` sets a line height — yielding to a utility that sets that property
  itself, as `text-sm leading-6` does, and replaced by a modifier, as in
  `text-sm/relaxed`), `aliases`, `format` (the value inside other text,
  `"brightness({value})"`) and `also` (extra declarations); `{ properties, values }`
  for keywords.
- `variants` — a name for any condition `css()` accepts; one starting with `::`
  is a pseudo-element block.

In any text of a rule, `{scale.key}` is that token (`"{compose.ring-shadow},
{compose.shadow}"`), and a property written `{scale.key}` sets the token's custom
property — how composed utilities such as `ring` and `shadow` share one
`box-shadow`.

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
a selector and its negation, and fixed positions counted from the same end — you
only need to declare what a library promises.

## `classes`

```ts
classes: { modules: ["resources/styles"], out: "public/kirana/classes.json" }
```

The class map for server templates. `modules` are files or folders, relative to
the root, whose exported handles Blade, Twig, ERB, HEEx and Edge templates name;
`kirana build` and `kirana dev` write their class strings to `out`, and compile
the modules whatever paths they were given. A recipe or a runtime value among the
exports is `classes-not-static`. See [server templates](/docs/frameworks/server-templates).

## `externals`

```ts
externals: ["meteor/"] // default: []
```

Specifier prefixes the bundler provides and Node.js resolution cannot find. An
import from one is a runtime value, as an installed package's is, instead of an
`unresolved-import` warning. `@kirana-style/ember` adds Ember's own (`@ember/`,
`@glimmer/`, `@embroider/virtual/`); [Meteor](/docs/frameworks/meteor) sets
`meteor/`.

## `root`

Set by the adapter, not by you: the project root, which scopes a build and makes
diagnostic paths relative.
