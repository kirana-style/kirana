# TanStack Start
Source: https://kirana.style/docs/frameworks/tanstack-start

# TanStack Start

This site, and the three applications of our shadcn/ui port, are TanStack
Start apps; this page is the setup they use. Tested on every change by
`examples/tanstack-start`, prerendered and on its dev server.



## Install and add the plugin

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

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

`mode.system` follows the operating system. To let readers choose Light or Dark
and keep the choice across reloads and tabs, see
[remembering the reader's choice](/docs/tokens/themes-and-modes#remembering-the-reader-s-choice).

## Typing `sx`

One reference, anywhere your `tsconfig.json` includes:

```ts
/// <reference types="@kirana-style/core/react" />
```

## Server rendering

There is nothing to do. Styles are in a stylesheet the document links, and class
names are in the markup, so server-rendered HTML is already styled, with no style
collection step, no flash and no double render.

Server components work the same way: the compiler runs at build time, so nothing
of Kirana has to run on the server at request time.

To render on Cloudflare Workers, add Cloudflare's Vite plugin before `kirana()`:
[Cloudflare Workers](/docs/building/cloudflare-workers) has the setup.

## Other setups

Every other framework has its own guide in [supported frameworks](/docs/frameworks/overview),
and React on other bundlers is in [other bundlers](/docs/integrations/bundlers).

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
