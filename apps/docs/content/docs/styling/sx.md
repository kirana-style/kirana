---
title: The sx prop
description: How sx works on elements and on components, what it compiles to, and how className and style survive it.
section: styling
parent: fundamentals
order: 2
keywords: [sx, className, style, props, components]
---

# The `sx` prop

`sx` is not an import. The compiler recognises it on any element in a module it
compiles, and turns it into `className`:

```tsx
<div sx={styles.root} />
// becomes
<div className="k5O_23ai kJ_1O3s" />
```

It takes a handle, or an array of handles, and skips `null`, `undefined` and
`false`:

```tsx
<div sx={[styles.root, isOpen && styles.open, sx]} />
```

Order is merge order, so a component's own styles come first and the caller's
`sx` last.

## On your own components

For a component you wrote, `sx` is an ordinary prop. Accept it, type it as `Sx`,
and apply it:

```tsx
import { css, type Sx } from "@kirana-style/core"

const styles = { root: css({ borderRadius: "0.5rem" }) }

export function Card({
  sx,
  ...props
}: { sx?: Sx } & React.ComponentProps<"div">) {
  return <div {...props} sx={[styles.root, sx]} />
}
```

Taking `sx` and never applying it is reported (`unused-sx`), because from the
outside the component looks styleable and silently is not.

## On components you did not write

A component from an installed package does not read `sx`. Passing it one does
nothing, and the compiler says so (`sx-on-external-component`) — including the
case where your own component forwards its rest props into one. Pass compiled
props instead:

<!-- prettier-ignore -->
```tsx
import { props as styleProps } from "@kirana-style/core"

<Dialog.Popup {...styleProps(styles.popup, sx)} />
```

[Styling other people's components](/docs/styling/external-components) covers the
cases.

## `className` and `style` still work

If an element has both `sx` and a `className`, they are merged, not replaced —
the class from `sx` is appended to whatever the element already had, including a
`className` arriving through a spread:

```tsx
<div {...props} className="legacy" sx={styles.root} />
```

The same is true of `style`. When a style needs a value known only at render time,
the compiler bridges it through a custom property and puts that in `style`, after
anything you passed.

## Typing

`sx` reaches React's element types through a reference, once per project:

```ts
/// <reference types="@kirana-style/core/react" />
```

The `Sx` type is what a component should accept: a handle, `null`, `undefined`,
`false`, or an array of those, nested.

## What it is not

`sx` does not take a bare style object:

```tsx
<div sx={{ color: "red" }} /> // error - wrap it in css({ … })
```

A string is not a class list either. With a preset that declares a utility
grammar, `sx="p-4"` is a [utility string](/docs/styling/utilities) that compiles
to the same atoms as its object; without one it is the `utility-surface-disabled`
error.
