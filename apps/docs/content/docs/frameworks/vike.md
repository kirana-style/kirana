---
title: Vike
description: Install Kirana in a Vike app on Vite, with vike-react, vike-vue or vike-solid, where sx compiles in pages, layouts and prerendered HTML.
section: frameworks
order: 4.7
keywords:
  [vike, vike-react, vike-vue, vike-solid, vite, ssr, prerender, install]
---

# Vike

Vike builds with Vite, so Kirana's Vite plugin compiles every page, layout and
`+` file before the renderer's plugin sees it, and prerendered HTML carries the
class names. Tested on every change by `examples/vike`, built and on its dev
server.

This page uses React. With Vue or Solid as the renderer, the steps are the same,
with the `sx` types of [Vue](/docs/frameworks/vue) or
[Solid](/docs/frameworks/solid).

<!-- ::npm-status -->

## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects the project, shows every change below as a diff, writes them once you
say yes, and prints the install command (`--install` runs it). Then
`npx kirana-style doctor` checks the result.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Kirana goes first, so pages reach the renderer's plugin and Vike's with `sx`
already a class name:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import vike from "vike/plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [kirana(), react(), vike()],
})
```

## 3. Import the stylesheet

In a file every page shares, `+Layout` or `+Head`:

```tsx file="pages/+Head.tsx"
import "@kirana-style/core/stylesheet.css"

export function Head() {
  return <meta charSet="utf-8" />
}
```

## 4. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": { "types": ["@kirana-style/core/react"] }
}
```

## 5. Write a page

```tsx file="pages/index/+Page.tsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default function Page() {
  return <h1 sx={title}>Hello</h1>
}
```

## Next

- [React](/docs/frameworks/react): `sx` in React components.
- [Your first component](/docs/start/first-component).
- [The Vite plugin](/docs/integrations/vite).
