# Component states
Source: https://kirana.style/docs/styling/states

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

```bash
npm install @kirana-style/states
```

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

## What a vocabulary holds

`@kirana-style/states/base-ui` is generated from the declarations Base UI
publishes for each part, so it follows the version it was generated from, and the
names are Base UI's own: `Select.Popup`, `AlertDialog.Popup`, `Toggle`.

| State                     | Example                       | Selector                     |
| ------------------------- | ----------------------------- | ---------------------------- |
| Present or absent         | `Switch.Root.checked`         | `[data-checked]`             |
| One of a set of values    | `Select.Popup.side.inlineEnd` | `[data-side="inline-end"]`   |
| Free text or a number     | `Accordion.Item.index`        | `[data-index]`, its presence |
| A component without parts | `Toggle.pressed`              | `[data-pressed]`             |

Values are in camel case (`inlineEnd` for `inline-end`).

## Other libraries, and your own components

A vocabulary is a plain object of selectors, so writing one takes a few lines. Any
library that marks state with data attributes works: Radix and its ports
(`data-state="open"`), Ark UI, Reka UI, Bits UI, or the components you write
yourself. Put it in a module of your project:

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
