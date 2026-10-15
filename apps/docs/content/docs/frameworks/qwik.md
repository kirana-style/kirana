---
title: Qwik
description: Install Kirana in a Qwik 2 app on Vite, where sx compiles to class, detected from jsxImportSource, rendered on the server and resumed in the browser.
section: frameworks
order: 12
keywords:
  [
    qwik,
    qwik router,
    qwik city,
    vite,
    install,
    class,
    jsxImportSource,
    resumability,
  ]
---

# Qwik

`sx` compiles to `class` (and a style attribute for values known only at
runtime). Kirana picks that up from the JSX import source in your `tsconfig.json`,
so there is nothing to configure.

Kirana supports **Qwik 2** (`@qwik.dev/core`): Qwik 1 runs only on
Vite 7 and older, and Kirana's Vite plugin needs Vite 8. Tested on every change
by `examples/qwik`, a Qwik Router app built and served with npm and pnpm.

<!-- ::npm-status -->

## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects Qwik, shows every change below as a diff, writes them once you say
yes, and prints the install command (`--install` runs it). Then
`npx kirana-style doctor` checks the result.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Kirana goes first, so Qwik's optimizer splits components that are already
compiled:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { qwikVite } from "@qwik.dev/core/optimizer"
import { qwikRouter } from "@qwik.dev/router/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [kirana(), qwikRouter(), qwikVite()],
})
```

One Kirana session serves the server render and the client build, so both name
the same classes.

## 3. Point `jsxImportSource` at Qwik, and type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@qwik.dev/core",
    "types": ["@kirana-style/core/qwik"]
  }
}
```

Without a `tsconfig.json`, set [`jsx: "qwik"`](/docs/config/reference) in
`kirana.config.ts` instead.

## 4. Import the stylesheet

In the root component, which every page renders:

```tsx file="src/root.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```tsx file="src/components/card.tsx"
import { css } from "@kirana-style/core"
import { component$ } from "@qwik.dev/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })
const wide = css({ width: "100%" })

export const Card = component$((props: { wide: boolean }) => (
  <div class="card" sx={[card, props.wide && wide]} />
))
```

Keep the handles at module level, as here: the optimizer moves each `$` function
into a module of its own, which imports them. A `class` already on the element is
merged with the styles into the one `class` it ends up with.

## In development

Qwik updates the page from the server render, so run the dev server in its SSR
mode (`vite --mode ssr`, which a Qwik Router app's `dev` script already does). A
style edit then reaches the page like any other edit.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [The Vite plugin](/docs/integrations/vite).
