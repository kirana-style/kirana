---
title: TanStack Start
description: Install Kirana in a TanStack Start app - the plugin, the root document, stylesheet order and server rendering.
section: frameworks
order: 4
keywords: [react, tanstack start, ssr, root, stylesheet order, server rendering]
---

# TanStack Start

This site, and the three applications of our shadcn/ui port, are TanStack
Start apps — this page is the setup they use.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows.

## Install and add the plugin

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Kirana ahead of the framework plugins, so modules reach them compiled; route
  // splitting re-emits modules under a query, and those are compiled too.
  plugins: [kirana(), tanstackStart(), viteReact()],
})
```

## The root document

Two things belong at the root: the stylesheets, in order, and the colour scheme.

```tsx file="src/routes/__root.tsx"
import kiranaCss from "@kirana-style/core/stylesheet.css?url"
import appCss from "./globals.css?url"

export const Route = createRootRoute({
  head: () => ({
    links: [
      // First: its `@layer` statement fixes the layer order before your CSS
      // opens the reset and base layers.
      { rel: "stylesheet", href: kiranaCss },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" sx={mode.system}>
      <head>
        <HeadContent />
      </head>
      <body sx={styles.body}>{children}</body>
    </html>
  )
}
```

`color-scheme` goes on `<html>`, not `<body>`: the root owns the page canvas and
the scrollbars.

## Typing `sx`

One reference, anywhere your `tsconfig.json` includes:

```ts
/// <reference types="@kirana-style/core/react" />
```

## Server rendering

There is nothing to do. Styles are in a stylesheet the document links, and class
names are in the markup, so server-rendered HTML is already styled — no style
collection step, no flash, no double render.

Server components work the same way: the compiler runs at build time, so nothing
of Kirana has to run on the server at request time.

## Other setups

Every other framework has its own guide in [supported frameworks](/docs/frameworks/overview),
and React on other bundlers is in [other bundlers](/docs/integrations/bundlers).
