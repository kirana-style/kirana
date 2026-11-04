---
title: Electrobun
description: Install Kirana in an Electrobun app, where Vite builds the view its Vite templates copy into the app.
section: desktop
order: 4
keywords: [electrobun, bun, desktop, webview, vite, hutch, install]
---

# Electrobun

An Electrobun app runs its main process on Bun and shows its views in a webview.
Its Vite templates build each view with Vite, and its config copies the output
into the app, so Kirana's Vite plugin goes in that build. Tested by
`examples/electrobun`, whose view is built and checked in Chromium.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Add Kirana first in the template's `vite.config.ts`, and keep the rest of it: the
view's root, the output Electrobun copies, the port its HMR mode loads and the
alias to Electrobun's view API:

```ts file="vite.config.ts"
import { resolve } from "node:path"

import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { electrobunViteAliases } from "./.hutch/devkit/api/config/electrobun-vite"

export default defineConfig({
  plugins: [kirana(), react()],
  resolve: {
    alias: electrobunViteAliases(resolve(__dirname, ".hutch/devkit")),
  },
  root: "src/mainview",
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
})
```

The `react-tailwind-vite` template also adds Tailwind's plugin; Kirana replaces it.

## 3. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "types": ["@kirana-style/core/react"]
  }
}
```

## 4. Import the stylesheet

```ts file="src/mainview/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```tsx file="src/mainview/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })

export const Card = () => <div sx={card} />
```

The template's `hutch run dev:hmr` runs Vite's dev server beside the app, so styles
update as you save; `hutch run build` runs `vite build` before Electrobun bundles
the app.

Electrobun uses the system's webview unless the app bundles Chromium (`bundleCEF`).
With the system's, set
[`targets.safari`](/docs/frameworks/desktop#set-targets-to-the-oldest-engine-you-support)
to the oldest WebKit the app supports on macOS and Linux.

## Next

- [Desktop and mobile apps](/docs/frameworks/desktop), for the engines and their
  targets.
- [React](/docs/frameworks/react), for `sx` and `className` in components.
- [The Vite plugin](/docs/integrations/vite).
