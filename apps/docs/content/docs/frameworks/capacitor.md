---
title: Capacitor
description: Install Kirana in a Capacitor app, whose Vite-built web app runs as a native iOS and Android app.
section: desktop
order: 5
keywords: [capacitor, ionic, ios, android, mobile, webview, vite, install]
---

# Capacitor

Capacitor runs a web app as a native iOS and Android app: Vite builds it into
`dist`, and `npx cap sync` copies that into the native projects. Kirana's Vite
plugin goes in that build. Tested by `examples/capacitor`, whose web app is built
and checked in Chromium.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), react()] })
```

`capacitor.config.ts` points at the build's output:

```ts file="capacitor.config.ts"
import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.example.app",
  appName: "Example",
  webDir: "dist",
}

export default config
```

## 3. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "types": ["@kirana-style/core/react"]
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

Run `vite build`, then `npx cap sync`, and open the native project. Develop in the
browser with Vite's dev server, or point the app at it with `server.url` in
`capacitor.config.ts` to see changes on a device.

## Set the oldest webview

iOS shows the app in WKWebView, which updates with iOS. Set
[`targets.safari`](/docs/frameworks/desktop#set-targets-to-the-oldest-engine-you-support)
to the Safari of the oldest iOS the app supports. Android's WebView updates
through the Play Store, so a Chrome target is rarely needed.

## Next

- [Desktop and mobile apps](/docs/frameworks/desktop), for the engines and their
  targets.
- [React](/docs/frameworks/react), or the guide for the framework your web app uses.
- [The Vite plugin](/docs/integrations/vite).
