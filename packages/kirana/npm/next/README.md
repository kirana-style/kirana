# @kirana-style/next

Kirana for Next.js, on Turbopack (the default for `next build` and `next dev`) and on webpack
(`next build --webpack`), from one `withKirana`
([11-integrations](../../../../spec/11-integrations.md), KRN-INT-010).

```js
// next.config.js
import { withKirana } from "@kirana-style/next"

export default withKirana({})
```

```js
// postcss.config.mjs
export default { plugins: { "@kirana-style/postcss": {} } }
```

```css
/* app/globals.css, imported by app/layout */
@kirana;
```

- **Turbopack.** `withKirana` adds a rule for the project's scripts that runs `@kirana-style/next/loader`,
  which rewrites styles into class names. Installed packages and modules that cannot hold styles never
  reach it. A project's own rules for the same globs are kept.
- **Stylesheet.** `@kirana-style/postcss` compiles the project where `@kirana;` stands. The loader and the
  plugin agree on class names without talking, because a name is a hash of what it styles.
- **webpack.** The same configuration adds `@kirana-style/webpack`'s plugin for `next build --webpack`.

Options: `root` (default: the working directory), and the webpack plugin's `config`, `reportInfo`.
`kirana init` writes all three files. How it works and what it costs: `design-notes/turbopack.md`.
