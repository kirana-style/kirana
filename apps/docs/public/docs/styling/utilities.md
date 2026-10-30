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
  paddingInline: { base: space[3], "@media (width >= 48rem)": space[4] },
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

Anywhere `sx` takes a style: on elements and on your components, alone, in an
array, or in a condition:

```tsx
<div sx="flex gap-2" />
<Card sx={["p-4", selected && "bg-muted", styles.card]} />
<li sx={open ? "font-semibold" : "text-muted-foreground"} />
```

Later utilities override earlier ones property by property, as later entries in
an array do. A template literal works only without substitutions:
``sx={`p-${n}`}`` is the `utility-not-static` error; write
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
Tailwind's `_` for a space works too.

Tailwind's `--spacing(n)` inside brackets counts steps of the space scale, so
`gap-[--spacing(var(--gap))]` is the scale's first step times `var(--gap)`.

A root that sets more than one property reads the bracketed value's shape, as
Tailwind infers its type:

| Utility                                       | Sets                |
| --------------------------------------------- | ------------------- |
| `text-[13px]`                                 | the font size       |
| `text-[#0af]`                                 | the colour          |
| `bg-[url(/a.png)]`, `bg-[linear-gradient(…)]` | a background image  |
| `bg-[var(--x)]`, any other bracketed value    | a background colour |

`text-sm` also sets its line height, and a `leading-*` replaces it wherever that
applies: `text-sm leading-relaxed` has one line height, and
`text-sm hover:leading-relaxed` keeps the size's own at rest.

Variants go before the utility and stack, in Tailwind's own forms. There is no
`dark:`: every colour token is already a `light-dark()` pair.

| Kind              | Variants                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| States            | `hover:`, `focus-visible:`, `disabled:`                                   |
| Media             | `md:`, `motion-reduce:`, `print:`, `pointer-fine:`, `any-pointer-coarse:` |
| Direction         | `rtl:`                                                                    |
| Attributes        | `data-open:`, `data-[state=open]:`, `data-side=left:`, `aria-invalid:`    |
| Structure         | `has-[svg]:`, `not-first:`, `nth-3:`, `[&:nth-child(2)]:`                 |
| Feature queries   | `supports-[display:grid]:`                                                |
| Container queries | `@md:`, `@md/card:`, `@[250px]:`; name a container with `@container/card` |
| Pseudo-elements   | `before:`, `after:`, `placeholder:`, `file:`, `selection:`                |

A pseudo-element variant becomes a block of its own, and `before:` and `after:`
get `content: ""`, as Tailwind gives them.

## Composed utilities

Some utilities share one CSS property, and combine instead of the later one
winning. As in Tailwind, each sets its own layer (a registered, non-inheriting
custom property from the preset's `compose` tokens), and the shared property reads
them all:

| Utilities                                                    | Share             |
| ------------------------------------------------------------ | ----------------- |
| `ring-2`, `shadow-sm`                                        | `box-shadow`      |
| `translate-x-4`, `translate-y-2`                             | `translate`       |
| `scale-*`                                                    | `scale`           |
| The filters, such as `grayscale`, `brightness-50`, `blur-sm` | `filter`          |
| The backdrop filters, such as `backdrop-blur-xs`             | `backdrop-filter` |

Transitions and outlines work the same way, so the order of the utilities does
not matter:

- `transition` reads the timing that `duration-*` and `ease-*` set;
- `outline-2` reads the style that `outline-hidden` set.

Uniform box utilities such as `p-4`, `m-4` and `inset-0` set both logical axes
(block and inline) rather than the shorthand.

The value is the same on every side, and a later `p-0` then replaces an earlier
`py-4` entry for entry, as `cn()` did.

## Animations

Tailwind's `animate-*` utilities (spin, ping, pulse and bounce) are here, and so is
the vocabulary of `tw-animate-css`, which shadcn/ui uses:

```tsx
<div sx="data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 duration-100" />
```

| Utilities                                                                 | What they do                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `animate-in`, `animate-out`                                               | Play the `enter` and `exit` keyframes                                      |
| `fade-in-0`, `zoom-in-95`, `spin-in-45`, `blur-in`, `slide-in-from-top-2` | Set what the animation starts from; their `-out` forms set what it ends at |
| `duration-*`, `ease-*`                                                    | Time the animation as well as transitions                                  |
| `delay-*`, `repeat-*`, `direction-*`, `fill-mode-*`                       | Set the animation's own properties                                         |

`slide-in-from-start` and `-end`, which depend on the writing direction, are not
utilities; write them with an `rtl:` condition.

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

Your design system's own conditions and styles are names too: a variant may name
the export that holds its condition, and `utilities.handles` names a style
handle a utility applies before the string's own declarations:

```ts file="kirana.config.ts"
utilities: {
  variants: { dark: { module: "./src/styles/mode.ts", export: "DARK" } },
  handles: { "scroll-fade": { module: "./src/styles/scroll-fade.styles.ts", export: "scrollFade" } },
}
```

A handle applies whole, so `md:scroll-fade` is `utility-unsupported`, as is a
variant whose export is a relation's condition, which a string key cannot hold.

Later presets and your own `utilities` replace earlier ones scale by scale, root
by root, variant by variant and handle by handle. The full shape is in the
[configuration reference](/docs/reference/config#utilities).
