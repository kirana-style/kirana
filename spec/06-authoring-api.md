# 06 — Authoring API

**Owns:** the normative v0.1 authoring surface — `css`, `cx`, `props`, `recipe`, `relation`, `select`,
`keyframes`, the `sx` prop, dynamic values at the call site, the reserved utility surface, and the
migration codemods.
**Depends on:** [00-glossary](./00-glossary.md), [20-decisions](./20-decisions.md) (D-003, D-004,
D-006, D-019, D-020, D-035, D-038, D-041, D-043), [07-tokens-themes-presets](./07-tokens-themes-presets.md),
[08-conditions-and-cascade](./08-conditions-and-cascade.md), [09-dynamic-styles](./09-dynamic-styles.md).

Semantics of merging, conditions and precedence are owned by
[08-conditions-and-cascade](./08-conditions-and-cascade.md); this document only defines shapes and
entry points. Diagnostic names refer to the catalogue in
[10-compiler-architecture](./10-compiler-architecture.md#diagnostic-catalogue).

## Package and entry points

All authoring imports come from one package, `@kirana-style/core`:

```ts
import {
  css, // one style → style handle
  cx, // merge style handles
  recipe, // component variants and slots
  relation, // group/peer-style relationships
  select, // contextual descendant targets
  keyframes, // @keyframes
  defineTokens, // tokens (see 07)
  defineTheme, // scoped themes (see 07)
  mode, // color-scheme handles for the root element (see 07)
  media,
  container,
  supports, // condition constructors (see 08)
  props, // { className, style } for components that do not take sx
  type Sx, // the sx prop type
} from "@kirana-style/core"
```

`@kirana-style/core/react` adds `sx` to React's host-element attribute types; an application references it once
(`/// <reference types="@kirana-style/core/react" />`). `@kirana-style/core/config` exports `defineConfig`, and
`@kirana-style/core/stylesheet.css` is the stylesheet import ([11](./11-integrations.md)).

**KRN-API-002** — Every Kirana value (styles, tokens, relations, keyframes, conditions, recipes) MAY be
declared in any module with any file name and imported with any import form: named, namespace,
default, re-export, or barrel. There is no special file extension (D-006).

## `css()` — styles

```ts
// button.styles.ts — any file name
import { css } from "@kirana-style/core"
import { space, radius } from "./tokens"
import { breakpoint } from "@kirana-style/preset-scales"

export const row = css({
  display: "flex",
  alignItems: "center",
  gap: space[2],
  paddingInline: { base: space[4], [breakpoint.md]: space[6] },
  borderRadius: radius.lg,
  opacity: { ":disabled": 0.5 },
})
```

**KRN-API-001** — `css(...inputs)` MUST accept one or more style objects or style handles and return a
style handle. When every input is static, the merge happens at build time and the handle compiles to a
constant class string.

Rules for style objects:

| Rule                     | Specification                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys                     | Standard CSS properties in camelCase (vendor-prefixed ones such as `WebkitLineClamp` included), custom properties as `"--name"`, and variable tokens as computed keys (`[ctx.iconSize]`, D-035). Unknown properties are a diagnostic (`unknown-property`).                                                                                                                         |
| Values                   | String, number, a token reference, a keyframes reference, or a conditional value object. A structurally broken value, or one that does not fit the property's grammar (KRN-CAS-010), is `invalid-value` ([08](./08-conditions-and-cascade.md#value-normalization)). Numbers follow CSS unitless rules; a number on a length property is `unitless-length`, never an implicit `px`. |
| Conditional value object | `{ base?: value, [condition]: value \| conditional value object }`. Conditions nest inside property values (property-first). Condition keys are defined in [08](./08-conditions-and-cascade.md); a component library's part states come as keys from `@kirana-style/states` (D-088, [11](./11-integrations.md#component-libraries)).                                               |
| `base`                   | The unconditional value. Omitting it keeps any earlier merged value; `null` removes it (D-013).                                                                                                                                                                                                                                                                                    |
| Pseudo-elements          | Top-level keys `"::before"`, `"::after"`, `"::placeholder"`, … whose value is a style object with its own conditional values.                                                                                                                                                                                                                                                      |
| Contextual targets       | Top-level keys created with `select` (below).                                                                                                                                                                                                                                                                                                                                      |

**KRN-API-003** — Conditions MUST be reusable values: a condition constant created with `media()`,
`container()`, `supports()`, a relation read, or a raw selector string may be declared in any module,
stored in variables, and used as a computed key. A condition that compiles MUST also run on the server
and the client.

**KRN-API-008** — Every style input position MUST accept `null`, `undefined` and `false` (skipped), and
the public types MUST accept every shape the compiler accepts, including `null` inside conditional value
objects.

## `cx()` — merging style handles

```ts
<div sx={cx(row, isActive && rowActive, props.sx)} />
// equivalent shorthand, since sx accepts arrays:
<div sx={[row, isActive && rowActive, props.sx]} />
```

**KRN-API-007** — `cx(...handles)` MUST merge in argument order: for each longhand and condition set,
the later handle's value replaces the earlier one. Static arguments merge at build time; runtime-selected
arguments merge through the private runtime ([09](./09-dynamic-styles.md#private-runtime)). Merge rules
are owned by [08](./08-conditions-and-cascade.md#merge-semantics).

## The `sx` prop

```tsx
import type { Sx } from "@kirana-style/core"

export function Card({
  sx,
  ...props
}: { sx?: Sx } & React.ComponentProps<"div">) {
  return <div {...props} sx={[cardBase, sx]} />
}
```

**KRN-API-004** — `sx` MUST be recognised on JSX elements in every style-bearing module without importing
anything. On a host (lowercase) element it compiles to `className` and, when variables are bridged,
`style`. On a component it is an ordinary prop carrying handles (D-019).

**KRN-API-014** — When `sx` compiles on a host element that also receives `className` or `style` — as an
explicit attribute or through a spread such as `{...props}` from a headless library's render prop — the
output MUST merge them (class strings joined, style objects merged with Kirana's bridged variables last)
instead of replacing them.

**KRN-API-005** — A component that declares an `sx` prop in its parameters and never applies it to an
element or forwards it to another component MUST produce the `unused-sx` diagnostic.

**KRN-API-016** — `sx` given to a component imported from an installed package MUST produce the
`sx-on-external-component` warning (D-041): such a component does not know the prop and would drop the
styles. The fix is `{...props(...)}`. The same warning MUST be produced one module away: `sx` given to a
project component whose parameters leave `sx` inside a rest object that it spreads onto a component from
an installed package or onto a host element (`function Trigger({ ...props }) { return <Menu.Trigger
{...props} /> }`). A written `sx` attribute compiles; `sx` carried inside a spread does not. The fix is to
take `sx` out and pass it on: `{...props(styles, sx)}` or `sx={[styles, sx]}`.

## `props()` — styles for components that do not take `sx`

<!-- prettier-ignore -->
```tsx
import { props } from "@kirana-style/core"

<Menu.Popup {...props(popup, sx)} />
useRender({ render, props: mergeProps({ ...props(item, sx) }, rest) })
```

**KRN-API-015** — `props(...handles)` MUST merge its arguments like `cx` and return `{ className, style }`
with tombstones stripped and bridged variables in `style`; plain class strings among the arguments pass
through. Under a JSX whose elements take `class` (Solid, Preact, Qwik) the key is `class`, so the object
spreads onto an element as it is, and that framework's type entry types the return so (KF-047). It serves headless libraries, render props and components from installed packages. Static
arguments compile to an object literal. A key with nothing to carry is left out, not `undefined`:
spread after an element's own `style` (`style={{ "--gap": n }} {...props(a)}`), it must not erase it.

## `recipe()` — variants and slots

```ts
export const button = recipe({
  base: { display: "inline-flex", alignItems: "center", gap: space[1.5] },
  variants: {
    variant: {
      primary: { backgroundColor: theme.primary, color: theme.primaryForeground },
      outline: { borderColor: theme.border, backgroundColor: "transparent" },
    },
    size: {
      sm: { height: space[7], paddingInline: space[2.5] },
      md: { height: space[8], paddingInline: space[3] },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  },
  compoundVariants: [{ variant: "outline", size: "sm", css: { borderWidth: "1px" } }],
  defaultVariants: { variant: "primary", size: "md" },
})

<button sx={[button({ variant, size }), sx]} />
```

Slots:

```ts
export const card = recipe({
  slots: ["root", "title", "body"],
  base: { root: { display: "grid" }, title: { fontWeight: 600 }, body: {} },
  variants: { size: { sm: { root: { gap: space[2] } }, md: { root: { gap: space[4] } } } },
})

const s = card({ size })
<section sx={s.root}><h2 sx={s.title} /></section>
```

**KRN-API-006** — `recipe()` MUST support `base`, `variants` (including boolean `true`/`false` keys),
`compoundVariants`, `defaultVariants`, and `slots`. Variant option types MUST be inferred from the
definition; an option or slot name that the recipe does not declare is `unknown-variant` or `unknown-slot`. A call with statically known options MUST compile to a constant class string; runtime
options merge the chosen parts through the private runtime (D-020, D-043, [09](./09-dynamic-styles.md)).
Compound variants apply after base and variants in merge order, and a recipe call's handles may be spread
into a handle list (`[ring, ...variants(options), sx]`).

## `relation()` — styling by another element's state

```ts
export const field = relation("field")

// anchor: the element whose state is read
<div sx={[field.anchor, fieldRoot]}>
  <label sx={label} />
</div>

// readers
export const label = css({
  opacity: { base: 1, [field.within('[data-disabled="true"]')]: 0.5 }, // like group-data-[disabled]
})
export const hint = css({
  display: { base: "none", [field.after(":focus-within")]: "block" }, // like peer-focus-within
})
```

**KRN-API-010** — `relation(name)` MUST return an object with `anchor` (a handle applied to the anchor
element), `within(condition?)` (reader is a descendant of the anchor), `parent(condition?)` (reader is
a child of the anchor, D-101), `after(condition?)` (reader is a later sibling of the anchor) and
`before(condition?)` (reader is an earlier sibling of the anchor, D-038). A reader applies when the anchor matches `condition`; `condition` may be
any pseudo-class, attribute selector, or `:has(...)`. Plain "this element contains X" needs no relation:
use a `":has(X)"` condition key. Validation rules are owned by
[08](./08-conditions-and-cascade.md#relation-validation).

`relation(name, { optional: true })` declares a relation its readers may meet without its anchor: a
reader installed without the component that applies the anchor, as registry items are, where the read
never matches. The options take `optional` alone, a boolean (D-112).

## `select` — contextual descendant styles

```ts
export const buttonIcons = css({
  [select.descendant("svg")]: {
    width: space[4],
    height: space[4],
    flexShrink: 0,
  },
  [select.child('[data-slot="icon"]')]: {
    marginInlineStart: `calc(${space[1]} * -1)`,
  },
})
```

`select.descendant(target)` and `select.child(target)` accept one compound selector: an element name,
attribute selectors and pseudo-classes, alone or together (D-061). Class selectors, IDs, combinators and
pseudo-elements are rejected
(`unsupported-contextual-target`). Contextual styles always lose to the target element's own styles
(D-016); precedence is owned by [08](./08-conditions-and-cascade.md#contextual-styles).

A condition nested inside a target's style object is the state of the element carrying the style, not of
the target, as it is under a pseudo-element (KRN-CAS-007): `[select.child("a")]: { color: { ":hover": x } }`
colours the link while its parent is hovered. The link's own hover is part of the target,
`[select.child("a:hover")]`. A pseudo-class nested that way is the `select-state-on-parent` info, since
a port from Tailwind (`*:hover:`) nearly always means the target's own state; reading the parent's state
through a relation says so without one (D-098).

## `keyframes()`

```ts
export const spin = keyframes({
  from: { rotate: "0deg" },
  to: { rotate: "360deg" },
})
export const spinner = css({
  animationName: spin,
  animationDuration: "1s",
  animationIterationCount: "infinite",
})
```

**KRN-API-009** — `keyframes()` MUST return a reference usable as `animationName` from any module. The
keyframes rule is emitted once per project when referenced. In a finished bundle a keyframes rule that
only code names, which no rule reads, is declared only when the bundle's chunks or other files still
name it, as KRN-TOK-012 has it for a variable token (D-094): a library's exported animations then ship
only where the application uses them. A chunk rendered after the stylesheet that names one left out
MUST fail the build.

## `firstThatWorks()`

```ts
export const screen = css({ minHeight: firstThatWorks("100dvh", "100vh") })
// .k… { min-height: 100vh; min-height: 100dvh }
```

**KRN-API-017** — `firstThatWorks(preferred, ...fallbacks)` MUST be accepted wherever a property value is
(conditional values, recipes, `keyframes()` frames, `positionTry()` blocks, `viewTransition()` parts) and
MUST write the property once per value, the preferred value last (D-074). Each value MUST expand and
validate as it would alone. The run is one atom whose class covers every value in order. Rejected with
`invalid-fallback`: no value, a nested run, a value that is not static or not CSS, and values that expand to
different longhands. A run on a custom property MUST warn (`fallback-on-variable`). One value is that
value. Outside a style, the call compiles to the preferred value.

## `positionTry()`

```ts
const below = positionTry({ positionArea: "bottom", marginTop: "4px" })
export const tooltip = css({ positionTryFallbacks: `${below}, flip-block` })
```

**KRN-API-018** — `positionTry(block)` MUST return a dashed ident (`--{prefix}p…`) hashed from the block
and emit one `@position-try` rule in `kirana.tokens` when referenced, like `keyframes()` (D-075). The block
MUST accept only inset, margin, sizing, self-alignment, `position-anchor` and `position-area` properties,
with static values or `firstThatWorks()` runs; any other property, a conditional value or a computed key
MUST report `invalid-position-try`.

## `viewTransition()`

```tsx
const slide = viewTransition({ old: { animationName: fadeOut }, new: { animationName: slideIn } })
<li sx={[card, slide]} style={{ viewTransitionName: `item-${id}` }} />
```

**KRN-API-019** — `viewTransition(parts)` MUST return a style handle whose only class (`{prefix}w…`) is
also its runtime value, so one value works in `sx`/`cx`/`props` and as a framework's transition class
(D-076). It MUST emit `.{class} { view-transition-class: {class} }` and one rule per part on
`::view-transition-group|image-pair|old|new(*.{class})`, in `kirana.tokens`, when used. Parts are
`group`, `imagePair`, `old` and `new`; a property MAY be conditional on `media()` and `supports()` only.
Any other key or condition MUST report `invalid-view-transition`. Kirana MUST NOT assign
`view-transition-name`: it must be unique per element, and belongs where the data that makes it unique is.

## `counterStyle()`

```tsx
const check = counterStyle({ system: "cyclic", symbols: '"✓"', suffix: '" "' })
const steps = css({ listStyleType: check })
const label = css({ "::before": { content: `counter(step, ${check}) ". "` } })
```

**KRN-API-020** — `counterStyle(descriptors)` MUST return a custom ident (`{prefix}c…`) hashed from the
descriptors and emit one `@counter-style` rule in `kirana.tokens` when referenced, like `keyframes()`
(D-091). It MUST accept only the CSS Counter Styles 3 descriptors (`system`, `symbols`,
`additiveSymbols`, `negative`, `prefix`, `suffix`, `range`, `pad`, `fallback`, `speakAs`), each a static
string, number, inlined token or counter style; a counter style referenced in `fallback` or in
`` system: `extends ${other}` `` ships with it. It MUST report `invalid-counter-style` for any other key, a
value that reads a custom property (descriptors cannot), an empty or non-CSS value, and a rule its system
cannot draw: `cyclic`, `numeric`, `alphabetic`, `symbolic` (the default) and `fixed` without `symbols`,
`additive` without `additiveSymbols`, `extends` with either. A system the compiler does not know is left
to the browser.

## Dynamic values at the call site

`css()`, `cx()` and recipe calls may appear inside components and receive runtime values:

```tsx
function Meter({ value, tone }: { value: number; tone: "ok" | "warn" }) {
  return (
    <div
      sx={css({
        inlineSize: `${value}%`, // open dynamic → CSS-variable bridge
        backgroundColor: tone === "ok" ? theme.success : theme.warning, // finite dynamic
      })}
    />
  )
}
```

**KRN-API-011** — Runtime-dependent values MUST be accepted in `css()` at the call site and compiled
according to [09-dynamic-styles](./09-dynamic-styles.md). Kirana never generates CSS at runtime (D-017).

## The utility surface

**KRN-API-012** — String values of `sx` are utilities (milestone M5, D-004, D-057):

```tsx
<button sx="inline-flex items-center gap-1.5 px-3 hover:bg-blue-600/90 md:px-4" />
```

A preset declares the utility grammar as data; the application enables it with
`presets: [scales()]` from `@kirana-style/preset-scales/preset` and may point scales at its own tokens in
`utilities`. Every utility lowers to the style object it stands for, with scale values read through
the same import resolution a real `import` uses, and that object compiles through the same path as
`css()`, so utility and object forms produce identical atoms. Later utilities override earlier ones
per property. `sx` takes utility strings wherever it takes a style — directly, in arrays, in
conditions (`open && "bg-muted"`), on host elements and on components — and a template literal only
without substitutions. `className` strings are never parsed.

Values: a scale key (`p-4`, `bg-blue-600`), a number of the rule's steps (`w-50`), a keyword
(`items-center`), a bracketed value used as written (`p-[3px]`, spaces allowed inside brackets), a
variable (`w-(--x)`), a negative (`-mt-2`), a colour with alpha (`bg-blue-600/50`, mixed with
`transparent`), a fraction (`w-1/2`). Variants: the grammar's names (`hover:`, `md:`, `@md:`) and
Tailwind's built-in forms — `data-*`, `aria-*`, `has-*`, `not-*`, `nth-*`, `supports-*`, `[&…]` on the
element itself, named and arbitrary container queries. A variant whose condition is a pseudo-element
(`::after`) makes a block of its own (KRN-CAS-007); `::before` and `::after` get `content: ""`.
Utilities that share a property compose through registered, non-inheriting tokens the grammar names
as `{scale.key}` (`ring-2` and `shadow-sm` → one `box-shadow`), as Tailwind composes `--tw-*`.

| Diagnostic                 | When                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `utility-surface-disabled` | a string `sx` with no grammar configured                                                      |
| `unknown-utility`          | a root or value the grammar does not have, with the nearest names                             |
| `unknown-utility-variant`  | a variant the grammar does not have, with the nearest names                                   |
| `utility-not-static`       | a template literal with substitutions                                                         |
| `utility-unsupported`      | `!important`, `group-*`/`peer-*` (use `relation`), arbitrary selector variants (use `select`) |

## Migration codemods

**KRN-API-013** — Kirana MUST provide one-shot codemods (D-003):

| Command                         | Rewrites                                                                                                                                                                                                                                                 | Reports (never guesses)                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kirana-style migrate stylex`   | `stylex.create` → `css`; `defineConsts`/`defineVars` → `defineTokens`; `createTheme` → `defineTheme`; `stylex.when.*` + markers → `relation`; `{...stylex.props()}`/`sx` → `sx`; context custom properties → `select` where the pattern is recognisable. | Relations whose placement cannot be proven; unlayered custom-property defaults. `default: null` entries are dropped, not mapped to `base: null`: StyleX's means "no base value", Kirana's removes an earlier one (D-013). `sx` on components from installed packages becomes `{...props()}`.                                    |
| `kirana-style migrate tailwind` | Static class strings → `css` objects using `@kirana-style/preset-scales`; `cn`/`clsx` → `cx`; `cva` → `recipe`; `group-*`/`peer-*` → `relation`; `[&_x]` → `select`.                                                                                     | Custom variants that need their definition looked up (for example shadcn's `data-horizontal`); `cn` conflict deletions that dropped paired values (such as a font-size's line-height); `border` utilities that set widths only; wrapper components whose default props (offsets, minimum widths) the class strings do not show. |

**Status (2026-09-23):** both are built (D-058). `kirana-style migrate tailwind` lowers class strings with the
configured utility grammar through the same crate as utility strings (`kirana_utility`), so an object
it writes compiles to the atoms of the string it replaced; it reads `@custom-variant` and `@utility`
from the CSS files among its paths, turns `className` props into `sx` (or `{...props()}` on components
from installed packages), and leaves every item it reports in a comment beside the style. Of the
reports column, `cn` conflict deletions and wrapper default props are not detected: both need knowledge
outside the class string. `border` is not reported: the grammar's `border` sets `borderStyle` too.
The lowering is also a call, `Driver.lowerTailwind(classes, file)` on `@kirana-style/compiler`: one class
string lowered as the codemod lowers a `className` in that file, returning the `css()` call, a module
with the imports and declarations it needs, the relations it anchors and what it left out (D-096).

The "reports" column exists because each item is a real porting mistake recorded in
the StyleX comparison. Codemod tests are
owned by [15-testing-and-conformance](./15-testing-and-conformance.md).
