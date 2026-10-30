# Next.js
Source: https://kirana.style/docs/frameworks/nextjs

# Next.js

Kirana works with both of Next.js's bundlers: **Turbopack**, the default for
development and production builds, and webpack (`--webpack`). Server components work
unchanged. Tested on every change by `examples/next-turbopack` and
`examples/next-webpack`, with npm and pnpm, in a production build and on the dev
server.



## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects Next.js and its bundler, shows every change below as a diff, writes
them once you say yes, and prints the install command (`--install` runs it). Then
`npx kirana-style doctor` checks the result. The steps it takes are the ones this page
shows, so you can also do them by hand.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/next @kirana-style/postcss postcss
```

## 2. Wrap the configuration

```ts file="next.config.ts"
import type { NextConfig } from "next"
import { withKirana } from "@kirana-style/next"

const nextConfig: NextConfig = {
  // your Next.js configuration
}

export default withKirana(nextConfig)
```

`withKirana` configures both bundlers: a Turbopack rule that compiles your
scripts, and the webpack plugin for `next build --webpack`. Rules you already have
for the same files are kept.

## 3. Add the PostCSS plugin

```js file="postcss.config.mjs"
export default {
  plugins: {
    "@kirana-style/postcss": {},
    // Tailwind CSS, autoprefixer and the rest stay as they are.
  },
}
```

## 4. Put the stylesheet in your global CSS

```css file="app/globals.css"
@kirana;
```

The root layout already imports `globals.css`. The PostCSS plugin replaces
`@kirana;` with the whole stylesheet: one file, every atom once.

## 5. Type `sx`

```ts file="kirana.d.ts"
/// <reference types="@kirana-style/core/react" />
```

## 6. Write a component

```tsx file="app/page.tsx"
import { css } from "@kirana-style/core"

const styles = {
  title: css({ fontSize: "2rem", color: { base: "#111", ":hover": "#555" } }),
}

export default function Page() {
  return <h1 sx={styles.title}>Hello</h1>
}
```

That is a server component: `sx` compiles to a class string at build time, so
nothing of Kirana runs at request time. In your editor, the line shows what the
element gets; see [editor support](/docs/tooling/editor).

## How the stylesheet gets built

Turbopack runs loaders, not bundler plugins, so no single step sees every module.
Kirana splits the work the way Tailwind CSS v4 does: the loader rewrites each
module's styles into class names, and the PostCSS plugin compiles the project into
the stylesheet. The two never talk: they agree because a class name is a hash of
what it styles, never of the order modules were built in. In development the
plugin tells Next.js which folders to watch, so an edit to a component reaches the
page without a restart.

The cost is measured in the design note
`packages/kirana/design-notes/turbopack.md`: 53 ms to compile the 104 scripts of this documentation site the first time, 5 ms
after an edit. One difference from the other adapters: the stylesheet holds the
atoms of every script in the project, imported or not.

## With webpack only

A project that always builds with `--webpack` can skip PostCSS and use the webpack
adapter on its own:

```bash
npm install @kirana-style/core
npm install -D @kirana-style/webpack
```

```js file="next.config.js"
import { withKirana } from "@kirana-style/webpack/next"

export default withKirana({})
```

```jsx file="app/layout.jsx"
import "@kirana-style/core/stylesheet.css"
```

Next runs a server and a client compiler over the same app, and a server
component is only seen by the server one. Every compiler of a project shares one
compiler session, which is how those atoms reach the stylesheet the client writes.

With webpack, `next dev --webpack` updates the stylesheet as Turbopack does: the
adapter rewrites a live stylesheet file on every edit, and Next rebuilds it and
sends it as a CSS hot update ([development servers](/docs/integrations/bundlers#development-servers)).

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
