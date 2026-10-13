---
title: Preact
description: Install Kirana in a Preact app on Vite - sx compiles to class, detected from jsxImportSource.
section: frameworks
order: 5
keywords: [preact, vite, install, class, jsxImportSource]
---

# Preact

`sx` compiles to `class` (and `style` for values known only at runtime). Kirana
picks that up from `jsxImportSource` in your `tsconfig.json`, so there is nothing
to configure. Tested by `examples/vite-preact`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Kirana goes before the Preact plugin, so Preact only ever sees compiled JSX:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import preact from "@preact/preset-vite"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), preact()] })
```

## 3. Point `jsxImportSource` at Preact, and type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["@kirana-style/core/preact"]
  }
}
```

Without a `tsconfig.json`, set [`jsx: "preact"`](/docs/config/reference) in
`kirana.config.ts` instead.

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

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [The Vite plugin](/docs/integrations/vite).
