---
title: Starting with no preset, then scales
description: Kirana ships no design decisions. Start with plain CSS values, adopt @kirana-style/preset-scales when you want a vocabulary, and keep the parts you need.
section: tokens
order: 2
keywords: [preset, preset-scales, tailwind scales, colors, spacing, breakpoints]
---

# From no preset, to scales

Kirana has no opinion about what your spacing scale is. There is no default theme
to override and nothing to reset. You start with plain CSS, and adopt a vocabulary
when you want one.

## Level 1: no tokens at all

Perfectly valid, and the right way to start a small thing:

```tsx
const card = css({
  borderRadius: "0.75rem",
  padding: "1rem",
  backgroundColor: "white",
})
```

Nothing to install, nothing to learn. The compiler is already doing its job:
atoms, merge rules, diagnostics.

## Level 2: the scales preset

When repeating raw values gets old, `@kirana-style/preset-scales` gives you a
vocabulary: the palette, spacing, type ramp, radii, shadows, blurs, durations,
easings and breakpoints of Tailwind CSS v4, generated from its own theme, as
typed tokens.

```tsx
import { css } from "@kirana-style/core"
import { color, space, radius, breakpoint } from "@kirana-style/preset-scales"

const card = css({
  borderRadius: radius.xl,
  padding: { base: space[4], [breakpoint.md]: space[6] },
  backgroundColor: color.zinc50,
})
```

There is no configuration step: you import what you use, and the bundler adapter
compiles the preset from `node_modules` as it compiles your own modules. A token
nothing references emits nothing, so importing the package costs nothing in the
output.

### What is in it

| Export                                                                           | Contents                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `color`                                                                          | 26 hues × 11 steps in `oklch`, plus `black` and `white`         |
| `space`                                                                          | `0`, `px`, `0.5` … `96`, in rem                                 |
| `fontFamily`, `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`, `leading` | the type ramp, with line heights paired to sizes                |
| `radius`, `shadow`, `blur`                                                       | the radii, shadows and blurs                                    |
| `duration`, `easing`                                                             | motion values                                                   |
| `zIndex`, `screen`, `containerSize`                                              | layering, and raw widths                                        |
| `breakpoint`, `containerQuery`                                                   | ready-made conditions: `[breakpoint.md]`, `[containerQuery.lg]` |

`breakpoint.*` and `containerQuery.*` are separate because they share step names
and mean different things: one queries the viewport, the other a container.

> [!NOTE] It is data, not a design system
> The preset deliberately stops at scales. It has no `primary`, `muted` or
> `background`: those are decisions about _your_ product, and they belong in your
> own semantic layer.

## Level 3: your own semantic layer

The next step is naming the decisions: what `primary` is, what a card's surface
is, what a border looks like in dark mode. That is
[semantic tokens](/docs/tokens/semantic-tokens), and it is where a design system
starts.

## Level 4: packaging a preset of your own

A preset is a module that exports token groups. To share yours, export them from a
package and import them like any other module:

```tsx
// @acme/tokens
export const brand = defineTokens("brand", { … }, { variable: true })

// an app
import { brand } from "@acme/tokens"
```

No registration and no plugin. Inside a workspace the package is compiled with
your own modules. Installed from npm, list it in [`libraries`](/docs/reference/config#libraries),
so its `defineTokens()` calls are compiled too; a token the app reads at runtime
would otherwise throw in the browser.

## The utility grammar

`@kirana-style/preset-scales/preset` declares Tailwind v4's utility names over these
scales, so `sx="px-4 text-sm"` works once the preset is listed:

```ts file="kirana.config.ts"
import scales from "@kirana-style/preset-scales/preset"

export default defineConfig({ presets: [scales()] })
```

The `/preset` entry holds only data and imports no tokens, because a
configuration file runs uncompiled. See [utility strings](/docs/styling/utilities).

The grammar composes some utilities through `compose`, a group of registered,
non-inheriting tokens mirroring Tailwind's `--tw-*` properties, such as
`compose.shadow` and `compose["translate-x"]`. A style object can set them too,
and then combines with those utilities on the same element:

```tsx
import { compose } from "@kirana-style/preset-scales"

css({ [compose.shadow]: "0 1px 2px rgb(0 0 0 / 0.05)" })
```

`animation` holds the keyframes the animation utilities play:

| From                                                   | Keyframes                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Tailwind                                               | `spin`, `ping`, `pulse`, `bounce`                              |
| `tw-animate-css` (MIT, credited in the package README) | `enter`, `exit`, and the accordion, collapsible and caret ones |

A style reads them by name:

```tsx
import { animation } from "@kirana-style/preset-scales"

css({ animationName: animation.spin, animationDuration: "1s" })
```

## How the grammar behaves

The grammar is data, but a few of its rules decide results you will notice. Each
matches what Tailwind v4 renders, and a property test checks every one of the
7,391 utilities it generates against the equivalent style object.

**A font size carries its line height.** `text-sm` sets the font size and the line
height paired with it. The pair is a default, not a declaration of its own:

- `text-sm leading-6` keeps `leading-6`, whichever comes first;
- `text-sm/relaxed` replaces the pair with `leading-relaxed`.

**Uniform box utilities are logical axes.** `p-4` sets the block and the inline
padding, so:

- a later `p-0` replaces an earlier `py-4`, as `cn()` did;
- a later `px-2` replaces only the inline axis.

**Composed utilities combine instead of replacing.** Each pair below ends up in
one property:

| Utilities                        | One property |
| -------------------------------- | ------------ |
| `ring-2`, `shadow-sm`            | `box-shadow` |
| `translate-x-4`, `translate-y-2` | `translate`  |
| `blur-sm`, `brightness-75`       | `filter`     |

Each utility sets a layer, a registered, non-inheriting custom property such as
`compose.translate-x` (as Tailwind's `--tw-*` ones are), and the property reads
all of them. So class order does not change the result.

**Transitions read their timing from layers too.** `transition` sets the list of
properties and reads the duration and easing utilities from their layers, so
`duration-200 transition` and `transition duration-200` agree.

Without either, the timing is Tailwind's: 150 ms, `cubic-bezier(0.4, 0, 0.2, 1)`.
`transition-none` also resets the duration and timing function, so it removes a
component's transition entirely, as `cn()` did by deleting the utility.

**`border` keeps a style you set.** `border` sets a 1 px width and reads the
border style from a layer that starts as `solid`; `border-dashed` sets that
layer. A component that is dashed stays dashed when a caller adds a plain border.

**A colour with an opacity is a mix.** `bg-primary/80` is
`color-mix(in oklab, <primary> 80%, transparent)`, as in Tailwind v4, so it works
on a `light-dark()` token and follows the colour scheme.

**Some names are not utilities.** They have no string form:

| Name                                                        | Write instead                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `!important`                                                | Nothing: the [ladder](/docs/styling/precedence) replaces it |
| `group-*`, `peer-*`                                         | A declared [relation](/docs/styling/relations)              |
| An arbitrary property, such as `[mask-type:luminance]`      | An object entry                                             |
| Gradients (`bg-linear-*`, `from-*`, `to-*`) and `container` | A value; they are not in the preset yet                     |
