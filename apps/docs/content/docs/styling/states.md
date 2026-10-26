---
title: Component states
description: Style a headless component's states (checked, open, the side a popup opened on) with typed condition keys, from Base UI, Ark UI, React Aria or any library that marks state with data attributes.
section: composition
order: 1.5
keywords:
  [
    states,
    data attributes,
    base ui,
    ark ui,
    react aria,
    zag,
    headless,
    checked,
    open,
    data-state,
    condition keys,
    "@kirana-style/states",
  ]
---

# Component states

A headless component library renders the behaviour and leaves the styling to you. It
tells you each part's state through data attributes: a switch's root gets
`data-checked` when it is on, a popup gets `data-side="bottom"` when it opened
below its trigger. In Kirana those are [condition keys](/docs/styling/conditions),
and `@kirana-style/states` lists them, so you pick a state instead of typing its
attribute:

```tsx
import { css } from "@kirana-style/core"
import { Select, Switch } from "@kirana-style/states/base-ui"

const styles = {
  track: css({
    backgroundColor: {
      base: "gray",
      [Switch.Root.checked]: { base: "blue", [Switch.Root.disabled]: "silver" },
    },
  }),
  thumb: css({
    translate: { base: "0", [Switch.Thumb.checked]: "1rem" },
  }),
  popup: css({
    marginTop: { [Select.Popup.side.bottom]: "4px" },
    marginBottom: { [Select.Popup.side.top]: "4px" },
  }),
}
```

- **A misspelt state is a type error.** `Switch.Root.chekced` does not exist, and
  your editor completes the states a part has.
- **Hover shows the library's own words.** Each state carries its description,
  `Present when the switch is checked.`, as Base UI writes it.
- **It is a condition like any other.** A state nests inside another, sits beside
  `media()`, reads through a [relation](/docs/styling/relations)
  (`field.within(Switch.Root.disabled)`) and goes in [recipes](/docs/styling/recipes).
  The compiler checks it as it checks every condition: above, `checked` and
  `disabled` can hold together, so the nested value says which wins.
- **Nothing ships.** Each entry is a plain string, `Switch.Root.checked` is
  `"[data-checked]"`; the compiler reads it and it leaves nothing behind.

The style is not tied to one part, so one handle can style several parts that
share a state, or the same state of your own component.

## Install

<!-- ::install packages="@kirana-style/states" -->

Apply the handles to Base UI's parts with [`props()`](/docs/styling/external-components),
since the parts do not read `sx`:

```tsx
import { props as styleProps } from "@kirana-style/core"
import { Switch as Base } from "@base-ui/react/switch"

export function Switch() {
  return (
    <Base.Root {...styleProps(styles.track)}>
      <Base.Thumb {...styleProps(styles.thumb)} />
    </Base.Root>
  )
}
```

## The vocabularies

Each one is generated from what its library publishes about its parts, so the
names are the library's own and a state the library does not document is not
there. CI regenerates them and checks every name against the library's exports.

| Import                               | Library                                 | Generated from                                                   |
| ------------------------------------ | --------------------------------------- | ---------------------------------------------------------------- |
| `@kirana-style/states/base-ui`       | Base UI                                 | each part's `*DataAttributes` declarations                       |
| `@kirana-style/states/ark-ui`        | Ark UI, on React, Vue, Solid and Svelte | `@zag-js/docs`, the reference of the Zag machines Ark UI runs on |
| `@kirana-style/states/react-aria`    | React Aria Components                   | each component's render props, by their `@selector`              |
| `@kirana-style/states/reka-ui`       | Reka UI, for Vue                        | each part's template, as the package ships it                    |
| `@kirana-style/states/bits-ui`       | Bits UI, for Svelte                     | each part's state class, by the types of its `props`             |
| `@kirana-style/states/ng-primitives` | Angular Primitives                      | each primitive's data bindings, and the interactions it turns on |

They differ where the libraries do:

- **Base UI and Ark UI** have parts: `Select.Popup.side.bottom`,
  `Switch.Thumb.state.checked`. Ark UI marks most states with one attribute's
  values (`data-state="checked"`), so `state` holds one key per value.
- **Ark UI's orientation**, which Zag describes only in prose, takes its values
  from Zag's own type, as Base UI's does: `Tabs.Root.orientation.vertical`.
- **React Aria** names a component per part, with no namespace:
  `Button.focusVisible`, `ListBoxItem.selected`. A state a component inherits
  from another's render props is there too.
- **Reka UI, Bits UI and Angular Primitives** document their states only in
  prose, so their vocabularies are read from the code the packages ship, with
  no descriptions. A value the code computes rather than writes, such as Reka
  UI's `side`, is its attribute's presence.
- **Angular Primitives** keys the primitive named for its component
  (`ngpPopover`) as `Root`, and lists the interactions a primitive turns on
  (hover, press, focus) as its states.

| State                     | Example                       | Selector                     |
| ------------------------- | ----------------------------- | ---------------------------- |
| Present or absent         | `Switch.Root.checked`         | `[data-checked]`             |
| One of a set of values    | `Select.Popup.side.inlineEnd` | `[data-side="inline-end"]`   |
| Free text or a number     | `Accordion.Item.index`        | `[data-index]`, its presence |
| A component without parts | `Toggle.pressed`              | `[data-pressed]`             |

How states are named:

- **Values are in camel case:** `inlineEnd` for `inline-end`.
- **React Aria's states are named for its render props, without `is`:**
  `isFocusVisible` is `focusVisible`.

## States that never hold together

A part is checked or unchecked, open or closed, never both. Two values of one
attribute say so on their own, but Base UI marks those with two attributes
(`data-checked`, `data-unchecked`), and nothing in the selectors proves they
exclude each other. So a property set under both is reported as
`ambiguous-precedence`, a warning that the order between them is left to chance.

Each vocabulary exports the groups its library sets one at a time. Give them to
[`conditions.exclusive`](/docs/reference/config) in your configuration, and the
compiler knows:

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"
import { exclusive } from "@kirana-style/states/base-ui"

export default defineConfig({ conditions: { exclusive } })
```

The groups are what the library documents: a state and its opposite, both on one
part.

| A state         | and its opposite |
| --------------- | ---------------- |
| `checked`       | `unchecked`      |
| `open`          | `closed`         |
| `startingStyle` | `endingStyle`    |
| `valid`         | `invalid`        |

Ark UI and React Aria mark those with one attribute's values or not at all, so
their lists are empty.

### One look for several libraries

A design system that writes each component once for several libraries spreads
every library's key for a state: Base UI's `[data-starting-style]` and React Aria's
`[data-entering]` for a popup's first frame. A component is built on one library,
so those keys never meet on an element, but nothing in the selectors says so, and
each pair is reported. `exclusiveAcross()` gives the compiler one vocabulary per
library; two keys that no single library sets are then exclusive:

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"
import { exclusiveAcross } from "@kirana-style/states"
import * as baseUi from "@kirana-style/states/base-ui"
import * as reactAria from "@kirana-style/states/react-aria"

export default defineConfig({
  conditions: {
    exclusive: [...baseUi.exclusive, ...reactAria.exclusive],
    exclusiveAcross: exclusiveAcross(baseUi, reactAria),
  },
})
```

Keys that both libraries set, such as `[data-disabled]`, still meet as they would
on any element.

## Other libraries, and your own components

A vocabulary is a plain object of selectors, so writing one takes a few lines. Any
library that marks state with data attributes works: Radix and its ports
(`data-state="open"`), Reka UI, Bits UI, or the components you write yourself. Put it in a module of your project:

```ts file="src/states.ts"
export const Dialog = {
  Content: {
    open: '[data-state="open"]',
    closed: '[data-state="closed"]',
  },
} as const
```

```tsx
import { css } from "@kirana-style/core"
import { Dialog } from "./states"

const content = css({
  opacity: { base: 1, [Dialog.Content.closed]: 0 },
  scale: { [Dialog.Content.open]: 1, [Dialog.Content.closed]: 0.95 },
})
```

`as const` is what makes a misspelt state an error. The compiler knows two values
of one attribute never hold together, so `open` and `closed` need no nesting.

## Next

- [Conditions](/docs/styling/conditions): every key a condition can be.
- [Relations](/docs/styling/relations): style an element from another element's
  state.
