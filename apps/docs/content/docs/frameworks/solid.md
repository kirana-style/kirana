---
title: Solid
description: Install Kirana in a Solid 1 or Solid 2 app on Vite, where sx compiles to class, detected from jsxImportSource.
section: frameworks
order: 6
keywords:
  [
    solid,
    solid-js,
    solid 2,
    "@solidjs/web",
    vite,
    install,
    class,
    jsxImportSource,
  ]
---

# Solid

`sx` compiles to `class` (and a style attribute for values known only at
runtime). Kirana picks that up from the JSX import source in your tsconfig, so
there is nothing to configure. Tested by `examples/vite-solid`, and by
`examples/vite-solid2` on [Solid 2](#solid-2).

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Kirana goes before the Solid plugin, so Solid only ever sees compiled JSX:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import solid from "vite-plugin-solid"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), solid()] })
```

## 3. Point `jsxImportSource` at Solid, and type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["@kirana-style/core/solid"]
  }
}
```

Kirana reads the JSX import source from this file and from what it extends, as
TypeScript does, but not from the files it references. Without one, or
where Vite's starter keeps it in a referenced file, set
[`jsx: "solid"`](/docs/reference/config) in `kirana.config.ts` instead. Kirana's
`init` writes it for you there.

## 4. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```tsx file="src/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })
const wide = css({ width: "100%" })

export const Card = (props: { wide: boolean }) => (
  <div class="card" sx={[card, props.wide && wide]} />
)
```

A `class` already on the element is merged with the styles into the one `class`
it ends up with, and so is a `className`.

`props()` follows the same rule: it returns `{ class, style }`, so its result
spreads onto an element as it is, and the type entry types it that way. Read its
`class`, never its `className`.

## Solid 2

Solid 2 moved its JSX to its DOM runtime, `@solidjs/web`, and its Vite plugin to
`@solidjs/vite-plugin`. The setup is the one above with those names:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import solid from "@solidjs/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), solid()] })
```

```json file="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@solidjs/web",
    "types": ["@kirana-style/core/solid"]
  }
}
```

`jsxImportSource: "@solidjs/web"` selects `jsx: "solid"`, and the same type entry
types `sx` on Solid 1's elements and Solid 2's. To start a Solid 2 app with the
component registry, take the example:

```bash
npx @kirana-style/registry init --template vite-solid2 my-app
```

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [The Vite plugin](/docs/integrations/vite).
