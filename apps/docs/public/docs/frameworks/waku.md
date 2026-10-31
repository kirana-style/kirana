# Waku
Source: https://site.kirana-style.workers.dev/docs/frameworks/waku

# Waku

Waku builds with Vite, and takes Vite plugins under `vite` in `waku.config.ts`.
Kirana compiles server components and client components alike, so a page
rendered at build time (`render: "static"`) has the class names in its HTML, and
the browser has the same ones. Tested on every change by `examples/waku`, built
and on its dev server.



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

```ts file="waku.config.ts"
import kirana from "@kirana-style/vite"
import { defineConfig } from "waku/config"

export default defineConfig({
  vite: { plugins: [kirana()] },
})
```

## 3. Import the stylesheet

In the root layout, which wraps every page:

```tsx file="src/pages/_layout.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 4. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": { "types": ["@kirana-style/core/react"] }
}
```

## 5. Write a page

A server component styles itself the way a client component does; there is no
runtime to keep out of it, because the styles are compiled away:

```tsx file="src/pages/index.tsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default async function Home() {
  return <h1 sx={title}>Hello</h1>
}

export const getConfig = async () => ({ render: "static" }) as const
```

## Next

- [React](/docs/frameworks/react): `sx` in React components.
- [Next.js](/docs/frameworks/nextjs), the other framework with server
  components that Kirana supports.
- [The Vite plugin](/docs/integrations/vite).
