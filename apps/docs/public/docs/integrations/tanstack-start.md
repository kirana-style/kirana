# React and TanStack Start
Source: https://kirana.style/docs/integrations/tanstack-start

# React and TanStack Start

Kirana compiles `sx` for React today. This site, and the three applications beside
it in this repository, are TanStack Start apps — so this page is the setup those
use.

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

## Other React setups

Any bundler with an adapter works the same way — see
[other bundlers](/docs/integrations/bundlers). The only React-specific part is the
JSX attribute, which [`jsx`](/docs/config/reference) selects; Preact and Solid are
covered in [frameworks](/docs/integrations/frameworks).
