---
title: vinext
description: Install Kirana in a vinext app, a Next.js app built by Vite, where server and client components compile sx to className in the App Router and the Pages Router.
section: frameworks
order: 3.2
keywords:
  [
    vinext,
    next.js,
    vite,
    react server components,
    rsc,
    app router,
    pages router,
    install,
  ]
---

# vinext

vinext runs a Next.js app on Vite: the same routes, layouts and Next.js modules,
built by Vite instead of Next.js's own build. Kirana's Vite plugin compiles every
route before vinext's plugin does, so server components and client components
carry the same class names, in the server render and in the browser. Tested on
every change by `examples/vinext`: built, served by `vinext start` and on its dev
server, with the Pages Router checked the same way.

<!-- ::npm-status -->

## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects vinext ahead of the `next` package a migrated app still lists, shows
every change below as a diff, writes them once you say yes, and prints the install
command (`--install` runs it). Then `npx kirana-style doctor` checks the result.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import vinext from "vinext"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [kirana(), vinext()],
})
```

Kirana goes first, so `app/` and `pages/` reach vinext with `sx` already compiled.

## 3. Import the stylesheet

In the root layout, which wraps every page:

```tsx file="app/layout.tsx"
import "@kirana-style/core/stylesheet.css"
```

With the Pages Router, import it in `pages/_app.tsx` instead.

## 4. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": { "types": ["vinext/types", "@kirana-style/core/react"] }
}
```

## 5. Write a page

A server component styles itself the way a client component does: the styles are
compiled away, so there is no runtime to keep out of it.

```tsx file="app/page.tsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default function Home() {
  return <h1 sx={title}>Hello</h1>
}
```

## Next

- [Next.js](/docs/frameworks/nextjs): the same app built by Turbopack or
  webpack.
- [React](/docs/frameworks/react): `sx` in React components.
- [The Vite plugin](/docs/integrations/vite).
