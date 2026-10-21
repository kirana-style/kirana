---
title: Styling other people's components
description: Style components that do not read sx with props(), and read what the sx-on-external-component diagnostic is telling you.
section: composition
order: 1
keywords: [props, styleProps, external, base ui, third party, className]
---

# Styling other people's components

`sx` works on elements your module renders. A component from an installed package
renders its own elements, and unless it happens to read a prop called `sx`, giving
it one does nothing.

The compiler catches this rather than letting you find it in the browser:

```console
$ kirana-style check src
warning[KRN1703] sx-on-external-component: a component from "@base-ui/react"
receives `sx`, which it does not read
  help: spread the compiled props instead: {...props(styles.root, sx)}
```

## `props()`

`props()` compiles the same handles into `{ className, style }`, which every
component that spreads its props onto an element will apply:

```tsx
import { css, props as styleProps } from "@kirana-style/core"

const styles = { popup: css({ borderRadius: "0.5rem" }) }

export function Popup({ sx, ...rest }: { sx?: Sx }) {
  return <Dialog.Popup {...rest} {...styleProps(styles.popup, sx)} />
}
```

<!-- ::figure-external -->

The alias `props as styleProps` is a convention, not an API: `props` is a common
identifier, and the alias keeps the import from shadowing a parameter.

To style a part's states (a switch that is checked, a popup that opened below its
trigger), take the keys from [component states](/docs/styling/states) instead of
typing the attributes.

## The case one module away

The diagnostic also fires when the component that receives `sx` is yours, but it
hands its rest props to an installed component without reading `sx` first:

<!-- prettier-ignore -->
```tsx
// Menubar.tsx
export function MenubarTrigger({ ...props }) {
  return <Menu.Trigger {...props} /> // `sx` rides along, unread
}

// page.tsx
<MenubarTrigger sx={styles.trigger} /> // reported here
```

Take `sx` out of the rest props and apply it:

```tsx
export function MenubarTrigger({ sx, ...props }: { sx?: Sx }) {
  return <Menu.Trigger {...props} {...styleProps(sx)} />
}
```

## Components that render something else

Some libraries let you supply the element a part renders as. The classes belong to
whichever element ends up in the DOM, so pass the styles to the part, and let it
merge:

```tsx
<SidebarMenuButton render={<a href="/docs" />} sx={styles.button} />
```

If instead you style the inner element and the outer part also sets classes, the
outer part's classes can be dropped: the part is not merging anything, it is
rendering your element.

## When you cannot pass props at all

Two options, in order:

1. **Style it from an ancestor you do render** with
   [`select.descendant`](/docs/styling/contextual). Contextual styles sit in a
   lower layer, so the element's own styles still win.
2. **Global CSS**, scoped by an attribute the library sets. This is the last
   resort: it is markup you do not own, and nothing checks it.
