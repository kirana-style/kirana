# Utility strings
Source: https://kirana.style/docs/styling/utilities

# Utility strings

With a preset that declares a utility grammar, `sx` also takes a string:

```tsx
<button sx="inline-flex items-center gap-1.5 px-3 hover:bg-blue-600/90 md:px-4" />
```

That string is not a class list. The compiler reads each utility, turns the
whole string into the style object you would have written by hand, and compiles
that object exactly as it compiles `css()`:

```tsx
css({
  display: "inline-flex",
  alignItems: "center",
  gap: space[1.5],
  paddingInline: { default: space[3], "@media (width >= 48rem)": space[4] },
  backgroundColor: {
    ":hover": "color-mix(in oklab, <blue-600> 90%, transparent)",
  },
})
```

There is one style path, so a utility and its object produce **the same atoms**,
share tokens, merge the same way, and get every diagnostic the object form gets.
The object form stays the reference; strings are a shorter way to write it.

## Turning it on

Utility strings are off until a preset declares a grammar.
`@kirana-style/preset-scales` ships Tailwind v4's names over its own scales:

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"
import scales from "@kirana-style/preset-scales/preset"

export default defineConfig({ presets: [scales()] })
```

Import the preset from `/preset`, not from the package root: a configuration file
runs uncompiled, and the root exports tokens, which only exist inside the
compiler.

Without a grammar, a string `sx` is the `utility-surface-disabled` error and the
attribute is left as written.

## Where strings go

Anywhere `sx` takes a style — on elements and on your components, alone, in an
array, or in a condition:

```tsx
<div sx="flex gap-2" />
<Card sx={["p-4", selected && "bg-muted", styles.card]} />
<li sx={open ? "font-semibold" : "text-muted-foreground"} />
```

Later utilities override earlier ones property by property, as later entries in
an array do. A template literal works only without substitutions:
``sx={`p-${n}`}`` is the `utility-not-static` error — write
`css({ padding: n })`, which Kirana bridges at runtime.

`className` strings are never read. Only `sx` is Kirana's.

## What a utility can say

| Form           | Example                            | Compiles to                                      |
| -------------- | ---------------------------------- | ------------------------------------------------ |
| Scale key      | `p-4`, `bg-blue-600`, `rounded-lg` | the preset's token                               |
| Keyword        | `items-center`, `flex`, `hidden`   | a fixed value                                    |
| Brackets       | `p-[3px]`, `bg-[rgb(1, 2, 3)]`     | the value as written                             |
| Negative       | `-mt-2`, `-inset-x-1`              | `calc(<value> * -1)`                             |
| Number         | `w-50`, `z-1`, `duration-450`      | 50 × `0.25rem`, `1`, `450ms`                     |
| Variable       | `w-(--sidebar-width)`              | `var(--sidebar-width)`                           |
| Colour + alpha | `bg-blue-600/50`                   | `color-mix(in oklab, <colour> 50%, transparent)` |
| Fraction       | `w-1/2`                            | `calc(1/2 * 100%)`                               |

Spaces inside brackets are fine (`bg-[rgb(1, 2, 3)]` is one utility), and
Tailwind's `_` for a space works too. Tailwind's `--spacing(n)` inside brackets
is `n` steps of the `space` scale's `1`: `gap-[--spacing(var(--gap))]` is
`calc(<space 1> * var(--gap))`.

Variants go before the utility and stack: `hover:`, `focus-visible:`,
`disabled:`, `md:`, `motion-reduce:`, `print:`, `rtl:`, and Tailwind's own forms —
`data-open:`, `data-[state=open]:`, `data-side=left:`, `aria-invalid:`,
`has-[svg]:`, `not-first:`, `nth-3:`, `supports-[display:grid]:`,
`[&:nth-child(2)]:`, and container queries `@md:`, `@md/card:`, `@[250px]:`
(name a container with `@container/card`). There is no `dark:`: every colour
token is already a `light-dark()` pair.

`before:`, `after:`, `placeholder:`, `file:` and `selection:` are pseudo-elements,
which `css()` writes as a block of their own; `before:` and `after:` get
`content: ""` as Tailwind gives them.

## Composed utilities

Some utilities share one CSS property: `ring-2` and `shadow-sm` both draw a
`box-shadow`, `translate-x-4` and `translate-y-2` one `translate`. As in Tailwind,
each sets its own layer — a registered, non-inheriting custom property from the
preset's `compose` tokens — and the shared property reads them all, so the two
combine instead of the later one winning. `ring`, `shadow`, `translate`, `scale`,
the filters (`grayscale`, `brightness-50`, `blur-sm`) and the backdrop filters
(`backdrop-blur-xs`) work this way, and so do transitions and outlines:
`transition` reads the timing `duration-*` and `ease-*` set, and `outline-2` the
style `outline-hidden` set, so the order of the utilities does not matter.

`p-4`, `m-4` and `inset-0` set both logical axes (`paddingBlock` and
`paddingInline`) rather than the `padding` shorthand. The value is the same on
every side, and a later `p-0` then replaces an earlier `py-4` entry for entry,
the way `cn()` did.

## Animations

Tailwind's `animate-spin`, `animate-ping`, `animate-pulse` and `animate-bounce`
are here, and so is the vocabulary of `tw-animate-css`, which shadcn/ui uses:

```tsx
<div sx="data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 duration-100" />
```

`animate-in` and `animate-out` play the `enter` and `exit` keyframes; `fade-in-0`,
`zoom-in-95`, `spin-in-45`, `blur-in` and `slide-in-from-top-2` set what they start
from (and their `-out`/`-out-to-` forms what they end at). `duration-*` and
`ease-*` time the animation as well as transitions, and `delay-*`, `repeat-*`,
`direction-*` and `fill-mode-*` set the animation's own properties.
`slide-in-from-start` and `-end`, which depend on the writing direction, are not
utilities; write them with a `rtl:` condition.

## What it will not do

These are errors that point to the Kirana way, never silently dropped classes:

| You wrote                         | Error                     | Instead                                                    |
| --------------------------------- | ------------------------- | ---------------------------------------------------------- |
| `p-huge`, `bg-blu-600`            | `unknown-utility`         | the message lists the nearest names                        |
| `hovr:underline`                  | `unknown-utility-variant` | the message lists the nearest variants                     |
| `!p-4`                            | `utility-unsupported`     | [precedence](/docs/styling/precedence) has no `!important` |
| `group-hover:…`, `peer-checked:…` | `utility-unsupported`     | [relations](/docs/styling/relations)                       |
| `[&_svg]:size-4`                  | `utility-unsupported`     | [select](/docs/styling/contextual)                         |
| `[mask-type:luminance]`           | `unknown-utility`         | write the property in `css()`                              |

There is no scan of your files, no `@apply`, no plugins, and no arbitrary
properties (`[mask-type:luminance]`).

## Your own tokens

A grammar reads its scales from modules, the way an `import` would. Point a
scale at your theme and `bg-primary` reaches your semantic tokens:

```ts file="kirana.config.ts"
export default defineConfig({
  presets: [scales()],
  utilities: {
    scales: {
      color: [
        { module: "@kirana-style/preset-scales", export: "color" },
        { module: "./src/theme.ts", export: "theme" },
      ],
    },
  },
})
```

Later presets and your own `utilities` replace earlier ones scale by scale, root
by root and variant by variant. The full shape is in the
[configuration reference](/docs/config/reference#utilities).
