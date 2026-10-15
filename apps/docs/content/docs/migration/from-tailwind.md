---
title: Migrating from Tailwind
description: The mental shift, the utility mapping, and the pitfalls that actually cost time.
section: migration
order: 1
keywords: [tailwind, migration, utilities, cn, cva, group, peer]
---

# Migrating from Tailwind

We have done this migration at full scale (every shadcn/ui component, three
applications) twice: once by hand (by way of the StyleX port), and once with
`kirana migrate tailwind`, until the result matched the Tailwind original with zero computed-style differences.
So this page is what it costs, not what it should cost in theory.

## The shift, in four lines

1. **A property, not a class.** `px-4` becomes `paddingInline: space[4]`.
2. **Conditions nest inside values.** `hover:bg-black` becomes
   `backgroundColor: { ":hover": … }`.
3. **A ladder, not specificity.** No `!important`, no arbitrary-variant ordering
   games. [Precedence](/docs/styling/precedence).
4. **Merging replaces entries.** `cn()` deleted a whole utility; Kirana replaces
   the entries you name. [Merging](/docs/styling/merging).

## The mapping

| Tailwind                      | Kirana                                                                      |
| ----------------------------- | --------------------------------------------------------------------------- |
| `flex items-center gap-2`     | `{ display: "flex", alignItems: "center", gap: space[2] }`                  |
| `px-4 py-2`                   | `{ paddingInline: space[4], paddingBlock: space[2] }`                       |
| `text-sm`                     | `{ fontSize: fontSize.sm, lineHeight: lineHeight.sm }`, always both         |
| `bg-primary/80`               | `{ backgroundColor: alpha.primary80 }`, a `color-mix` token                 |
| `hover:underline`             | `{ textDecorationLine: { ":hover": "underline" } }`                         |
| `md:grid-cols-2`              | `{ gridTemplateColumns: { [breakpoint.md]: "repeat(2, minmax(0, 1fr))" } }` |
| `dark:bg-zinc-900`            | nothing: the token is a `light-dark()` pair                                 |
| `group-hover:opacity-100`     | `{ opacity: { [group.within(":hover")]: 1 } }`                              |
| `peer-checked:text-black`     | `{ color: { [peer.after(":checked")]: "black" } }`                          |
| `[&_svg]:size-4`              | `{ [select.descendant("svg")]: { width: …, height: … } }`                   |
| `cn(a, b)`                    | `cx(a, b)`, or `sx={[a, b]}`                                                |
| `cva({ variants })`           | [`recipe({ variants })`](/docs/styling/recipes)                             |
| `data-[state=open]:rotate-90` | `{ rotate: { '[data-state="open"]': "90deg" } }`                            |

The vocabulary itself carries over: `@kirana-style/preset-scales` is generated from
Tailwind v4's own theme, so `space[4]`, `color.zinc500` and `breakpoint.md` are
the values you already know.

## The four that do not translate directly

**`text-sm` sets two properties.** Tailwind's type utilities set a size _and_ a
line height. Write both, every time: a size without its line height is the most
common visual drift in a port.

**`border` sets a colour.** Tailwind's preflight gives every element a default
border colour, so `border` alone is visible. Kirana has no preflight: `border`
sets widths only, and you name the colour.

**`cn()` conflict resolution is gone, and that is the point.** `cn("p-2", "p-4")`
kept the last. Kirana merges per entry, so the same intent is `padding: space[4]`
written once. But a _conditional_ value you did not name survives. Read
[merging](/docs/styling/merging) before porting a component with states.

**Arbitrary variants that read classes** (`[&:not([class*='size-'])]`) have no
equivalent, because Kirana's class names are hashes. Use
[`select`](/docs/styling/contextual): contextual styles sit in a lower layer, so
the child's own style wins without a guard.

## The codemod

> [!TIP] Porting with a coding agent
> The [`kirana-migrate` skill](/docs/project/agent-skills) gives an agent this
> page's process: the codemod and its report, the traps, and how to prove the
> port renders the same.

`kirana migrate tailwind` rewrites Tailwind's constructs into Kirana's:

| Tailwind        | Kirana                               |
| --------------- | ------------------------------------ |
| class strings   | `css()` objects                      |
| `cn(…)`         | `sx` arrays                          |
| `cva`           | [`recipe`](/docs/styling/recipes)    |
| `group`, `peer` | [relations](/docs/styling/relations) |
| `[&_svg]:`      | [`select`](/docs/styling/contextual) |

It uses the same [utility grammar](/docs/styling/utilities) as utility strings, so
the object it writes compiles to exactly the atoms of the class string it replaces.

<!-- ::figure-codemod -->

First give the project the vocabulary, and point the colour scale at your theme:

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"
import scales from "@kirana-style/preset-scales/preset"

export default defineConfig({
  presets: [scales()],
  utilities: {
    scales: {
      color: [
        { module: "@kirana-style/preset-scales", export: "color" },
        { module: "./src/theme.ts", export: "theme" },
      ],
    },
    // shadcn's `@custom-variant`s, as conditions
    variants: { "data-horizontal": '[data-orientation="horizontal"]' },
  },
})
```

Then run it over your sources and your CSS. The CSS is read for `@custom-variant`
and `@utility`, so a custom variant nobody declared is reported instead of
silently getting Tailwind's default meaning:

```bash
kirana migrate tailwind src src/globals.css            # read the diff and the report
kirana migrate tailwind src src/globals.css --write
kirana check src
```

A colour's `dark:` value becomes a `light-dark()` pair. Any other property's
becomes a `{ light, dark }` token in a small group at the top of the file, which
follows the colour scheme and Kirana's [`mode`](/docs/tokens/themes-and-modes)
handles.

So where your theme switch sets `.dark`, set `mode.dark` too.

A Base UI part rendering one of your components (`render={<Button />}`) hands
its styles to that component as `sx`, since both are one element and a class
merged into the component's props would replace the component's own.

`space-x-2` and `divide-y` become a `select.child(":not(:last-child)")` block,
which, like Tailwind's `:where()` rule, loses to a child's own margin or border.

Where a class goes:

- A component's `className` prop becomes `sx`, in its props type too.
- A component from an installed package (Base UI parts) gets `{...props(…)}`
  instead, because it does not read `sx`.
- A class string known only at runtime stays in `className`, where the compiler
  merges it with `sx`.

A class string that stays on one of your own components is reported too: once
migrated, the component reads `sx`, so the class lands in its props and their
spread replaces its styles. A library that hands your component a `className`
(react-day-picker's `components`) does the same without any file showing it; take
`className` out of the props there.

A `select` block ranks below the target's own styles, where Tailwind's parent
rule usually won. When the parent and the target both carry a `data-slot`, the
codemod moves the rule onto the target, as a condition on its position
(`':is([data-slot="field"] > [data-slot="field-label"])'`), so the result is the
same. When it cannot (no `data-slot` on the parent, a recipe variant) and the
target sets the property itself, it says so, and the fix is to read the parent
from the target by hand.

What it reports rather than guesses:

- `!important` under a variant;
- custom variants and utilities nobody declared;
- a contextual target under a condition (`focus:**:text-x`);
- targets that are class names;
- `in-*` on anything but a `data-slot` (`in-data-[slot=x]:` becomes a relation
  every `data-slot="x"` element anchors);
- a colour's `dark:` with no value at rest;
- relations anchored in no migrated file;
- a dropped `w-`/`h-` guard;
- dynamic class strings.

Each report item is also left as a `// tailwind:` comment beside the style it
concerns, so the diff shows where to look.

## Measured: the Tailwind original of our shadcn/ui port

We ran the codemod over the whole Tailwind original (`packages/ui`, the shared
shell, and the demo, blocks and examples applications) and compared the result
with the original, element by element.

| Step                            | Result                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| The codemod, unedited           | 199 report items                                                                        |
| Hand fixes                      | 38 patches, each resolving report items or a difference conformance found               |
| Conformance, at rest            | **0 differences** on 1 + 64 + 124 routes, three widths, light and dark                  |
| Conformance, interactive states | **0 differences**: dialogs, menus with a highlighted row, selects, tabs, hover, focus … |

"Conformance" is the computed style of every `[data-slot]` element, including
`::before` and `::after`, diffed against the Tailwind build. What it does not
prove: right-to-left layouts, focus rings and states outside the harness's list,
and elements without a `data-slot`. Check those by reading or by hand.

The 199 items, by reason: 39 `!important` under a variant, 35 class strings built
at runtime (they stay classes), 33 contextual targets under a condition, 20
targets that are class names or siblings, 16 contextual rules the target
outranks, 13 arbitrary selectors, 12 utilities the preset lacks (gradients,
`container`, and a few misspelt classes that render nothing in Tailwind either),
9 `dark:` values on non-colours, and 22 informational. Most need no change; the
38 patches are the ones that did.

## Pitfalls we hit

Every one of these compiled cleanly and rendered differently. They are listed
roughly by how often they cost us time.

**A parent's rule no longer beats the child's own.** In Tailwind,
`*:data-[slot=label]:w-full` on a field beat the label's own `w-fit`, because a
variant's rule is printed after plain utilities, or is more specific. In Kirana a
`select` block ranks below the target's own styles. That is what lets an icon keep
its own size without a `:not([class*='size-'])` guard.

The codemod moves such rules onto the target when both ends carry a `data-slot`;
when it cannot, it reports "sets `width` itself, which outranks a contextual
rule". Fix it by letting the target read the parent, with a relation
(`inGroup.within()`) or a condition on its own position
(`':is([data-slot="field"] > *)'`). It was our most common hand fix.

**`!important` has no equivalent.** Without a variant, `p-0!` becomes
`{ "*": null, base: 0 }`, which removes every other padding entry, as the
important flag did. Under a variant (`hover:size-3!`) it is reported: decide
where the value belongs, usually as a condition on the element that must win.

**A class name passed to a migrated component replaces its styles.** A migrated
component reads `sx`; a `className` that still reaches it lands in the props
spread, after the component's own class, and replaces it. Look for libraries that
hand your components a class you never see: react-day-picker's `components` gave
its day button one, and every day button lost its styles. Take the class name out
of those props.

**A guard that was an escape hatch.** `*:[div:not([class*='w-'])]:w-full` let a
child opt out by carrying any class starting with `w-`, including `max-w-*`.
Class names are hashes in Kirana, so the guard is dropped and reported; a child
that relied on it needs `width: auto` of its own.

**Selectors that read class names.** `[.border-b]:pb-6` on a card header asked
whether the header had a bottom border class. There is no such class after the
migration: set the padding where the border is set.

**A `light-dark()` pair is replaced whole.** Tailwind's `bg-background` over
`bg-transparent dark:bg-input/30` left the dark rule in place, and it still won
in dark mode.
In Kirana the override replaces the pair, so an override that must keep the dark
value carries both halves: `light-dark(var(--background), <input/30>)`.

**Variant order used to decide.** Where Tailwind's stylesheet order made
`dark:hover:bg-muted/50` beat `aria-expanded:bg-muted`, Kirana's ladder decides
instead: an attribute outranks `:hover`. The codemod already lets a colour's
`dark:` value outrank the states it encloses; the rest you nest (hover inside the
attribute, since two conditions beat one).

**`sr-only` and margins.** Tailwind printed the screen-reader class's
`margin: -1px` before a legend's own `mb-1.5`, which won. The migrated `sr-only`
style leaves the bottom margin alone, so the element's own margin still applies.

**Suffix selectors cannot be moved.** `**:data-[slot$=-item]:…` matches every
slot ending in `-item`; the codemod cannot know which elements those are. We
moved the rules into a shared style that each item applies.

**Custom variants must be declared.** shadcn's `data-open:` and
`data-horizontal:` are `@custom-variant`s, not Tailwind's defaults. Pass your CSS
to the codemod so it reads them; an undeclared one is reported instead of getting
the wrong meaning.

## Utility strings or objects?

The codemod writes objects, because an object is what the rest of these docs
describe and what the [language server](/docs/project/roadmap) will explain. But
with the scales preset, `sx="flex items-center gap-2"` is valid Kirana too, and
compiles to the same atoms. A reasonable split: strings for short layout lines,
objects for anything with states or tokens of your own. See
[why vertical styles read well](/docs/start/why-kirana#it-doubles-the-code).

## Migrating by hand

Without the codemod (a handful of components, or a codebase whose class strings
are mostly dynamic), work component by component with the mapping above, and:

1. Give every component `sx?: Sx` in place of `className`, and replace
   `cn(base, className)` with `sx={[styles.base, sx]}`.
2. Turn each `cva` into a [`recipe`](/docs/styling/recipes); `defaultVariants`
   carry over.
3. Replace each `group`/`peer` with a declared [relation](/docs/styling/relations);
   the compiler errors on a read nobody anchors.
4. Replace `[&_svg]:` and `*:` with [`select`](/docs/styling/contextual), and
   delete the `:not([class*='size-'])` guards: the child's own size wins anyway.
5. Delete every `dark:` on a colour; write the colour as a `light-dark()` token.
6. Run `kirana check` and resolve every diagnostic before moving on.

## The process that worked

1. **Port leaf components first.** They have the fewest conditions and teach you
   the shape.
2. **Port structure verbatim.** Keep the same elements and attributes; change only
   how the styles are expressed. Then a visual diff means something.
3. **Run `kirana check` after each component.** `sx-on-external-component` and
   `unused-sx` catch the two mistakes everyone makes with wrapper components.
4. **Compare computed styles, not screenshots.** We kept the
   Tailwind build alongside the Kirana one and diffed the computed styles of every
   element in both schemes at three widths. Eyes miss a 1 px border; a diff does
   not.
5. **Check interactive states too.** Open every overlay, highlight a menu row,
   hover a button and focus an input, then diff again. Some differences exist
   only in a state: a hovered, expanded ghost button in dark mode was one.
6. **Keep hand fixes as patches.** We kept each fix as a patch applied over a
   fresh run of the codemod, so the codemod could improve and be re-run without
   losing work. A patch that stops applying is a sign the codemod now does that
   fix itself.
7. **Fix the original when it is the one that is wrong.** Several "differences"
   we found this way were bugs in the Tailwind original.

## What you get for the trouble

Type checking on every property and value, a stated answer to "which style wins",
diagnostics for the mistakes that used to be silent, and a stylesheet that grows
with distinct declarations instead of with markup.
