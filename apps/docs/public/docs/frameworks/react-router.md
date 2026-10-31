# React Router
Source: https://site.kirana-style.workers.dev/docs/frameworks/react-router

# React Router

React Router's framework mode builds with Vite, so Kirana's Vite plugin is all it
needs: `sx` compiles to `className`, on the server render and in the browser
alike. Tested on every change by `examples/react-router`, built and on its dev
server. A Remix 2 app is a React Router app; [Remix 3](/docs/frameworks/remix) has
a guide of its own.



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

Kirana goes before React Router's plugin, so routes reach it as source:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { reactRouter } from "@react-router/dev/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [kirana(), reactRouter()],
})
```

## 3. Import the stylesheet

In the root route, which renders the document:

```tsx file="app/root.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 4. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": { "types": ["@kirana-style/core/react"] }
}
```

## 5. Write a route

```tsx file="app/routes/home.tsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default function Home() {
  return <h1 sx={title}>Hello</h1>
}
```

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [The Vite plugin](/docs/integrations/vite).
