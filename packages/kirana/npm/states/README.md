# @kirana-style/states

Component states as [Kirana](https://kirana.style) condition keys, for Base UI, Ark UI, React
Aria, Reka UI, Bits UI and Angular Primitives. A headless UI library tells its
parts' states through data attributes (`data-checked`, `data-side="bottom"`); this package lists
them, per component and part, as the selectors Kirana's conditions already take. A misspelt state
is a type error, and the editor shows the library's own description of each one.

```ts
import { css } from "@kirana-style/core"
import { Select, Switch } from "@kirana-style/states/base-ui"

export const track = css({
  backgroundColor: {
    base: "gray",
    [Switch.Root.checked]: { base: "blue", [Switch.Root.disabled]: "silver" },
  },
})

export const popup = css({
  marginTop: { [Select.Popup.side.bottom]: "4px" },
})
```

Each entry is a plain string (`Switch.Root.checked` is `"[data-checked]"`), so it works wherever a
condition does: nested in another, beside `media()`, in a relation (`field.within(Switch.Root.disabled)`)
and in recipes. The package has no runtime: the compiler reads the strings and they leave nothing
behind.

| Subpath           | Library                                                               | Generated from                                                                                              |
| ----------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `./base-ui`       | [Base UI](https://base-ui.com) (`@base-ui/react`)                     | each part's published `*DataAttributes` module, and the open state its mapping writes                       |
| `./ark-ui`        | [Ark UI](https://ark-ui.com), on React, Vue, Solid and Svelte         | `@zag-js/docs`, the data attributes of Zag's machines, and their code                                       |
| `./react-aria`    | [React Aria Components](https://react-spectrum.adobe.com/react-aria/) | each component's render props, by their `@selector`                                                         |
| `./reka-ui`       | [Reka UI](https://reka-ui.com), for Vue                               | each part's template, as the package ships it                                                               |
| `./bits-ui`       | [Bits UI](https://bits-ui.com), for Svelte                            | each part's state class, by the types of its `props`                                                        |
| `./ng-primitives` | [Angular Primitives](https://angularprimitives.com) (`ng-primitives`) | each part's data and host bindings, its interactions, those of what it composes, and what its portal writes |

Each subpath also exports `exclusive`: the states its library sets one at a time (`checked` and
`unchecked`, `open` and `closed`), for `conditions.exclusive` in `kirana.config`, so a property set
under both is not `ambiguous-precedence`:

```ts
import { defineConfig } from "@kirana-style/core/config"
import { exclusive } from "@kirana-style/states/base-ui"

export default defineConfig({ conditions: { exclusive } })
```

A design system that writes each component once for several libraries passes `exclusiveAcross()`,
from the package's root, one vocabulary per library: two state keys no single library sets never meet
on an element, so their pairs are not reported either.

```ts
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

A state that takes values (`side`, `align`, `orientation`) has one key per value, in camel case
(`Select.Popup.side.inlineEnd` is `'[data-side="inline-end"]'`). A state whose value is free text or
a number (`index`) is its attribute's presence. Angular Primitives' states take their values from
the type of what they bind (`NgpOrientation`, `NgpPlacement`, `NgpAvatarStatus`), so
`Tabs.Tabset.orientation.vertical` is `'[data-orientation="vertical"]'`, and a part built on another
primitive has its states too (`Accordion.Item.open` from the collapsible it calls, `Menu.Item.hover`
from the button). A state written both empty and with a value has a key per value and `any`, the
attribute's presence whatever its value: Button writes `data-disabled="soft"`, or an empty
`data-disabled` when it is fully disabled, so `Button.Root.disabled.any` is `"[data-disabled]"` and
`Button.Root.disabled.soft` `'[data-disabled="soft"]'`, as on every part built on the button
(`Menu.Item.disabled.any`). The elements Angular Primitives' portal renders have the `enter` and
`exit` it marks them with as they come and go: an overlay's content (`Popover.Root.enter`,
`Select.Dropdown.exit`, with the overlay's `instant`), a toast, and a dialog and its overlay. Ark UI's `orientation` takes its values from Zag's
`Orientation` type (`@zag-js/types`), since Zag's reference describes it in prose. Ark UI's parts
also have what their prop getter in Zag's code sets and the reference leaves out, through the helpers
it spreads: Radio Group's `Item`, `ItemText` and the item states of its `ItemControl`. Segment Group,
which runs Radio Group's machine, has the same parts under its own name. A part whose component merges
another part's getter onto its element has that getter's states: `Menu.CheckboxItem` and
`Menu.RadioItem` the option item's, Date Picker's `TableCell` and `TableCellTrigger` those of the
day, month and year cells, and a part that mounts and unmounts the `open` and `closed` Ark UI's
presence writes (`Tabs.Content.state.open`). `RootProvider` has no entry: it renders `Root`'s
element, which `Root`'s keys style.

For another library, or your own components, write the same shape in a module of your own; see
[States](https://kirana.style/docs/styling/states).

The files in `src/` are generated by `bun run gen:states` in `packages/kirana` from the pinned
`@base-ui/react`, `react-aria-components`, and `@zag-js/docs` with Zag's machines at the Zag version
Ark UI depends on.

## Credits and license

The component and part names, the state names and their descriptions come from Base UI 1.9.0, used
under the MIT License:

> MIT License
>
> Copyright (c) 2019 Material-UI SAS
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
> OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The Ark UI vocabulary's component and part names, state names and descriptions come from Zag 1.45.0
(`@zag-js/docs` and the `@zag-js/*` machines Ark UI depends on), used under the MIT License:

> MIT License
>
> Copyright (c) 2021 Chakra UI
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
> OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The Ark UI vocabulary also reads Ark UI's own components (`@ark-ui/react` 5.39.3, Copyright (c) 2024
Chakra UI, under the same MIT License): its part names, the states of its Field and Fieldset, the
getters each part merges and the `open` and `closed` its presence writes.

The React Aria vocabulary's component names, state names, selectors and descriptions come from
`react-aria-components` 1.22.1, Copyright 2019 Adobe, used under the Apache License 2.0, whose full
text ships in this package as `licenses/react-aria-components.txt`. They are reorganised here as
condition keys; the selectors and descriptions are otherwise as React Aria writes them.

This package is not affiliated with Base UI, MUI, Chakra UI, Ark UI or Adobe. Kirana itself is MIT
licensed.
