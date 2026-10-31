# SolidStart
Source: https://site.kirana-style.workers.dev/docs/frameworks/solid-start

# SolidStart

SolidStart 2 builds with Vite, with its configuration in `vite.config.ts`, so
Kirana's Vite plugin is all it needs: `sx` compiles to `class`, on the server
render and after hydration alike. Tested on every change by
`examples/solid-start`, built and on its dev server.



## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects the project, shows every change below as a diff, writes them once you
say yes, and prints the install command (`--install` runs it). Then
`npx kirana-style doctor` checks the result.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin

Kirana goes before SolidStart's plugin, so routes reach Solid's compiler with
`sx` already a class:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [kirana(), solidStart(), nitro()],
})
```

## 3. Import the stylesheet

In the root component, which every route renders inside:

```tsx file="src/app.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 4. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": { "types": ["@kirana-style/core/solid"] }
}
```

## 5. Write a route

```tsx file="src/routes/index.tsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default function Home() {
  return <h1 sx={title}>Hello</h1>
}
```

## Next

- [Solid](/docs/frameworks/solid): `sx` in Solid components, and what it
  compiles to.
- [Your first component](/docs/start/first-component).
- [The Vite plugin](/docs/integrations/vite).
