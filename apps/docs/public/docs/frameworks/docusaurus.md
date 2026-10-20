# Docusaurus
Source: https://kirana.style/docs/frameworks/docusaurus

# Docusaurus

Docusaurus builds with webpack, twice: the browser bundle, and the server render
that writes each page's HTML. A plugin of a few lines adds Kirana's webpack
plugin to both, and the two share one compiler session, so a class name is the
same in the HTML and in the browser. Tested on every change by
`examples/docusaurus`, built and on its dev server.



## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It writes the configuration and the stylesheet's import, and tells you the
plugin to add (step 2). Then `npx kirana-style doctor` checks the result.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/webpack
```

## 2. Add the plugin

```ts file="docusaurus.config.ts"
import type { Config, Plugin } from "@docusaurus/types"
import { KiranaPlugin } from "@kirana-style/webpack"

function kirana(): Plugin {
  return {
    name: "kirana",
    configureWebpack: () => ({ plugins: [new KiranaPlugin()] }),
  }
}

export default {
  // …
  plugins: [kirana],
} satisfies Config
```

Kirana's loader runs ahead of Docusaurus's own, so it reads `sx` before JSX is
compiled away.

## 3. Declare Docusaurus's aliases

`@theme/Layout`, `@docusaurus/Link` and the rest are webpack aliases that
Node.js resolution cannot follow. Listed as externals, imports from them are
runtime values, without an `unresolved-import` warning on every page:

```ts file="kirana.config.mts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({
  externals: [
    "@theme/",
    "@theme-original/",
    "@theme-init/",
    "@site/",
    "@generated/",
    "@docusaurus/",
  ],
})
```

## 4. Import the stylesheet

In the theme's `Root`, which wraps every page (create it if the site has none):

```tsx file="src/theme/Root.tsx"
import "@kirana-style/core/stylesheet.css"

export default function Root({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

## 5. Write a page

```tsx file="src/pages/index.tsx"
import { css } from "@kirana-style/core"
import Layout from "@theme/Layout"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default function Home() {
  return (
    <Layout>
      <h1 sx={title}>Hello</h1>
    </Layout>
  )
}
```

Infima, the classic theme's CSS framework, is unlayered: on an element it
styles itself (a link's colour, a heading's margin), its rule beats yours.
Style your own elements, or wrappers around Infima's, and it does not come up.

## Next

- [React](/docs/frameworks/react): `sx` in React components.
- [The webpack plugin](/docs/integrations/webpack).
- [Layers](/docs/config/layers).
