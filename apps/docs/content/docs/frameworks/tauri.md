---
title: Tauri
description: Install Kirana in a Tauri app, whose frontend Vite builds and the system's webview shows on desktop and mobile.
section: desktop
order: 3
keywords: [tauri, rust, desktop, mobile, webview, vite, install]
---

# Tauri

A Tauri app is a Rust core and a web frontend. `create-tauri-app` builds the
frontend with Vite, so Kirana's Vite plugin goes there, and nothing changes in
`src-tauri`. Tested by `examples/tauri`, whose frontend is built and checked in
Chromium.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Kirana goes first in the plugins of the config `create-tauri-app` wrote. Keep its
`server` options: Tauri waits for that port.

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [kirana(), react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
```

## 3. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "types": ["@kirana-style/core/react", "vite/client"]
  }
}
```

## 4. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```tsx file="src/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })

export const Card = () => <div sx={card} />
```

`tauri dev` runs Vite's dev server and opens the app on it, so styles update as you
save. `tauri build` runs `vite build` first and bundles `dist`, stylesheet
included.

## Set the oldest webview

Tauri shows your pages in the system's webview: WebView2 on Windows, WKWebView on
macOS and iOS, WebKitGTK on Linux and Android's WebView. When the app supports
older macOS, iOS or Linux releases, set
[`targets.safari`](/docs/frameworks/desktop#set-targets-to-the-oldest-engine-you-support)
to the oldest WebKit among them.

## Next

- [Desktop and mobile apps](/docs/frameworks/desktop), for the engines and their
  targets.
- [React](/docs/frameworks/react), or the guide for the frontend framework you
  picked in `create-tauri-app`.
- [The Vite plugin](/docs/integrations/vite).
