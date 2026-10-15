# Gatsby
Source: https://kirana.style/docs/frameworks/gatsby

# Gatsby

Gatsby builds with webpack in stages: the browser bundle, and the server render
that writes each page's HTML. `@kirana-style/gatsby` adds Kirana's webpack plugin to
every stage, and the stages share one compiler session, so the HTML and the
browser agree on every class. Tested on every change by `examples/gatsby`, built
and on its dev server.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published. Until they are, install them from tarballs as [Installation](/docs/start/installation#install-from-tarballs) shows; the rest of this page is the same either way.

## The fast way

In the project's root:

```bash
npx kirana-style init
```

It detects the project, shows every change below as a diff, writes them once you
say yes, and prints the install command (`--install` runs it). Then
`npx kirana-style doctor` checks the result.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/gatsby
```

## 2. Add the plugin

```js file="gatsby-config.js"
module.exports = {
  jsxRuntime: "automatic",
  plugins: ["@kirana-style/gatsby"],
}
```

`jsxRuntime: "automatic"` is Gatsby's own option, and the one its starters use;
without it every component needs `import React`.

## 3. Import the stylesheet

```js file="gatsby-browser.js"
import "@kirana-style/core/stylesheet.css"
```

## 4. Write a page

```tsx file="src/pages/index.tsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export default function Home() {
  return <h1 sx={title}>Hello</h1>
}
```

Type `sx` with `"types": ["@kirana-style/core/react"]` in `tsconfig.json`.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [The webpack plugin](/docs/integrations/webpack), which does the work.
- [Styles](/docs/styling/styles).
