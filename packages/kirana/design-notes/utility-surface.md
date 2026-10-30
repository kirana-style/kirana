# The utility surface (2026-09-23)

KRN-API-012 reserves string values of `sx` for a utility surface, and M5 builds it:

```tsx
<button sx="inline-flex items-center gap-1.5 px-3 hover:bg-blue-600/90 md:px-4" />
```

This note settles open question Q-04, where the vocabulary lives, how a utility compiles, and what
proves it right. It is M5 phase 1.

## Q-04: strings only

`sx` takes utility strings wherever it takes a style: `sx="px-3"`, `sx={["px-3", open && "bg-muted"]}`,
and a template literal without substitutions. **No template tags** (`` tw`px-3` ``):

- a tag is a function call the compiler must recognise and the type checker cannot help with, for
  nothing a string in `sx` does not already give;
- interpolation inside a utility string (`` `px-${n}` ``) is exactly what cannot compile to a fixed
  set of atoms, and `css({ paddingInline: n })` already says it clearly, bridged at runtime;
- `className` strings stay untouched (KRN-API-012): only `sx` is Kirana's.

A template literal with substitutions is the `utility-not-static` diagnostic, pointing at `css()`,
wherever `sx` takes a value (directly, in an array, in a condition's branch). A variable holding a
string is a runtime value like any other and cannot be recognised as a utility.

## The vocabulary is data, in a preset

A preset declares a **utility grammar** next to its tokens (KRN-TOK-008 anticipated this). The grammar
is JSON-shaped data the Driver passes to the engine in the resolved configuration (KRN-CMP-013); no
compiler code lives in a preset:

```ts
// kirana.config.ts — the preset entry imports no tokens: a configuration file runs uncompiled
import scales from "@kirana-style/preset-scales/preset"

export default defineConfig({ presets: [scales()] })
```

`@kirana-style/preset-scales` ships **Tailwind v4's vocabulary** over its own scales: it already _is_
Tailwind's scales (D-010), and the surface exists for people who think in those names. Legal note L5
applies: utility names are a vocabulary, not copied code.

The grammar has three parts:

```ts
{
  // Where scale values come from: an export of a module, looked up as an import would be.
  scales: {
    space: [{ module: "@kirana-style/preset-scales", export: "space" }],
    color: [{ module: "@kirana-style/preset-scales", export: "color" }],
  },
  // What each utility root sets. Alternatives are tried in order (`text-sm` is a font size,
  // `text-blue-600` a colour).
  utilities: {
    p: [{ properties: ["padding"], scale: "space" }],
    text: [
      { properties: ["fontSize"], scale: "fontSize", pair: { lineHeight: "lineHeight" } },
      { properties: ["color"], scale: "color", alpha: true },
    ],
    flex: [{ static: { display: "flex" } }],
    items: [{ properties: ["alignItems"], values: { center: "center", start: "flex-start" } }],
  },
  // What each variant is: a condition key css() already accepts.
  variants: { hover: ":hover", md: "@media (width >= 48rem)", open: "[data-state=\"open\"]" },
}
```

A pair is the scale's default, not a declaration of its own: `text-sm leading-6` keeps `leading-6`'s
line height whichever comes first, as Tailwind's `--tw-leading` does, and `text-sm/relaxed` replaces it
with the `lineHeight` scale's `relaxed` (both engine and codemod settle pairs through `settle_pairs`).
The pair goes only where the direct value applies: `text-base hover:leading-6` keeps the size's line
height at rest and `leading-6`'s on hover, where `line-height: var(--tw-leading, …)` falls back in
Tailwind (KF-076). A direct value under conditions the pair does not have all of (`md:text-sm
hover:leading-6`) leaves both, and the ladder decides where both apply.

An application extends it in its own configuration — `utilities: { scales: { color: [{ module:
"./src/theme.ts", export: "theme" }, …] } }` — so `bg-primary` reaches its semantic tokens. Later
presets and the application's own `utilities` override earlier ones root by root.

## How a utility compiles

Before a string reaches the engine's style path, it is lowered to **the object a person would have
written**: `"px-3 hover:bg-blue-600/90"` becomes the value of
`css({ paddingInline: space[3], backgroundColor: { ":hover": "color-mix(in oklab, <blue-600> 90%, transparent)" } })`,
with `space` and `color` fetched through the same import resolution a real `import` uses. That value
then goes through the function `css()` itself uses. There is no second style path, so:

- the atoms are identical to the object form's **by construction** — same tokens, same conditions,
  same merge (later utilities win per property, as later entries do);
- a token that is a variable in the object form is a variable in the utility form, and one that
  inlines, inlines;
- every existing diagnostic (unknown property, ambiguous precedence) applies unchanged.

A value in brackets is used as written (`p-[3px]`, `bg-[#0af]`), and picks among a root's rules by
its shape, as Tailwind infers a type: a colour goes to the colour rules (`text-[#0af]` against
`text-[13px]`), and where the root has an image rule an image goes to it alone (`bg-[url(…)]`,
`bg-[repeating-linear-gradient(…)]`: every comma-separated layer a `url()`, a gradient or `image()`,
`image-set()`, `cross-fade()` or `element()`, `var()`s aside), anything else to the others. Brackets
also take Tailwind's `--spacing(n)`,
which is `calc(<space 1> * n)` with the `space` scale's token; `-` negates (`-mt-2`); `/n` on a
colour mixes it with `transparent` the way Tailwind v4 does; `data-[x=y]:` and `aria-[x]:` are
attribute conditions. `!important`, `group-*` and `peer-*` are not utilities in Kirana: the first is
the `utility-unsupported` diagnostic, the others point to `relation`.

An unknown utility or variant is an error (`unknown-utility`, `unknown-utility-variant`) with the
nearest known names, never a silently dropped class. Utilities are separated by whitespace except
inside `[…]`, so `bg-[rgb(1, 2, 3)]` is one utility; Tailwind's `_` for a space works too.

## Built (2026-09-23)

- `@kirana-style/preset-scales/preset` declares 180 utility roots and 70 variants; the property test
  generates **6,915** utilities from them and every one compiles to the same atoms as its object.
- The property test found a real bug on its first run: the preset generator had filed Tailwind's
  `--text-shadow-*` values under `fontSize` (Tailwind's `text-` prefix holds both), so `fontSize`
  carried five text shadows. They are now their own `textShadow` scale.
- A string `sx` without a configured grammar is still `utility-surface-disabled`, and the attribute
  is left as written.

## Extended for the migration (2026-09-23)

Measuring `kirana-style migrate tailwind` on the Tailwind original showed the grammar missing whole
mechanisms, not just names. Each is data in the grammar, lowered by the shared crate
(`kirana_utility`), so utility strings gained them too:

- **Numbers that are not keys** (`number: { step, unit }`): `w-50` is 50 × 0.25rem, `z-1`, `duration-450`,
  `border-3`, `opacity-15`, `line-clamp-3`.
- **`(--x)`** is `var(--x)`, Tailwind 4's shorthand.
- **Pseudo-elements** are variants whose condition starts with `::`; they become a block of their own
  (KRN-CAS-007), and `before:`/`after:` get `content: ""` as Tailwind gives them.
- **Tailwind's built-in variant forms**: `data-open`, `data-side=left`, `aria-invalid`, `has-*`, `not-*`,
  `nth-*`, `supports-*`, `[&:…]` on the element itself, named and arbitrary container queries
  (`@md/card`, `@[250px]`), and `@container/card`.
- **Composed utilities.** Tailwind composes `ring-2` and `shadow-sm` into one `box-shadow`, and
  `translate-x-4` with `translate-y-2` into one `translate`, through `--tw-*` custom properties it
  registers with `inherits: false`. The grammar says the same: a property or a value may name a token
  as `{scale.key}`, and `@kirana-style/preset-scales` exports `compose`, registered non-inheriting tokens
  with Tailwind's initial values. `ring-2` sets `{compose.ring-width}`, `{compose.ring-shadow}` and the
  same five-layer `box-shadow` Tailwind writes (computed parity with the twin is checked by the M5 exit's
  conformance run, not yet). A rule's
  `format` places its value in text (`brightness({value})`).
- **Uniform box utilities as logical axes** (D-060): `p-4` is `paddingBlock` and `paddingInline`, so
  a later `p-0` replaces an earlier `py-4` as `cn()` did.
- **Transitions and outlines compose** like the rest: `transition` reads the `duration-*`/`ease-*`
  layers, `outline-*` the outline-style layer and `border-*` the border-style one (`border-dashed` then a caller's `border` stays dashed), so class order does not change the result.
- **A kebab-case key finds its camelCase token**: `bg-primary-foreground` reaches `theme.primaryForeground`.

Filters (`grayscale`, `brightness`, `backdrop-blur`) compose through **unset** registered tokens
(D-059): a token of syntax `"*"` may have no value, and its references are `var(--k…,)`, so the chain
is Tailwind's own `var(--tw-blur,) var(--tw-brightness,) …`. The animation utilities of tw-animate-css
(`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-top-2`, …) are keyframes and registered layers
in the preset, with the plugin's fallbacks as initial values. Arbitrary properties
(`[mask-type:luminance]`) stay out of utility strings; the codemod writes them as object entries.

The property test now generates **7,391** utilities, every one identical to its object.

## Proof

The M5 exit asks that "utility and object forms of the same styles produce identical atoms". A
**property test** generates, from the grammar itself, every utility root with every key of its scale
or keyword table, compiles each once as a string and once as the hand-written object with the real
import, and requires the same class names. Adding a utility to the grammar adds it to the test.

## What this is not

- Not Tailwind: there is no JIT scan of `className`, no `@apply`, no plugins, no arbitrary
  properties (`[mask-type:luminance]`). Everything lowers to typed style objects.
- Not a second API. The object form stays the reference; the language server (M3) will show a
  utility's object and CSS on hover.
