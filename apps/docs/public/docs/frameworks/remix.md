# Remix
Source: https://kirana.style/docs/frameworks/remix

# Remix

Remix 3 has no bundler. `node-tsx` compiles TypeScript and JSX as Node loads the
server, and the asset server compiles client entries as the browser asks for
them. Both hand on only the JavaScript that comes out, so Kirana compiles after
them, on the compiled JSX calls: `sx` becomes `className` in the server render and
in the browser alike. The server's compiler session has seen every module, client
entries included, and serves the stylesheet. Tested on every change by
`examples/remix`, on its server and its dev server.

This page is about Remix 3. A Remix 2 app is a [React Router](/docs/frameworks/react-router)
app now; follow that guide.



## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It adds the hook to your scripts (step 2) and tells you the lines to add to the
router and the asset server (steps 3 and 4). Then `npx kirana-style doctor` checks
the result.

## 1. Install

```bash
npm install @kirana-style/core @kirana-style/remix
```

`@kirana-style/remix` is a dependency, not a dev dependency: the hook, the loader
and the middleware run in your server.

## 2. Load Kirana after `node-tsx`

In every script that starts the server, after `--import remix/node-tsx`:

```json file="package.json"
{
  "scripts": {
    "dev": "node --watch --import remix/node-tsx --import @kirana-style/remix/node server.ts",
    "start": "node --import remix/node-tsx --import @kirana-style/remix/node server.ts"
  }
}
```

Node runs the hook registered last first, so Kirana's hook asks `node-tsx` for the
compiled module and compiles its styles.

## 3. Serve the stylesheet

`stylesheet()` answers `/kirana.css` from the server's compiler session:

```ts file="app/router.ts"
import { stylesheet } from "@kirana-style/remix"

export const router = createRouter({
  middleware: [stylesheet(), staticFiles("./public"), renderMiddleware],
})
```

Link it from the document:

```tsx file="app/actions/document.tsx"
<link rel="stylesheet" href="/kirana.css" />
```

It is minified when `NODE_ENV` is `production`; `stylesheet({ path, minify })`
changes either.

## 4. Compile client entries

Client entries reach the browser through the asset server. Add Kirana's loader to
its scripts, and allow `@kirana-style/core`, whose runtime a compiled module may
import:

```ts file="app/assets.ts"
import { kiranaLoader } from "@kirana-style/remix"

export const assets = createAssetServer({
  allowPackages: ["remix", "@kirana-style/core"],
  scripts: { loaders: [kiranaLoader] },
})
```

## 5. Type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": { "types": ["node", "@kirana-style/core/remix"] }
}
```

## 6. Write a component

A server-rendered component and a client entry style themselves the same way:

```tsx file="app/actions/public/notice.tsx"
import { css } from "@kirana-style/core"
import { clientEntry } from "remix/component"

const styles = {
  notice: css({
    paddingInline: "1rem",
    color: { base: "black", ":hover": "blue" },
  }),
}

export const Notice = clientEntry(import.meta.url, function Notice() {
  return () => <p sx={styles.notice}>Hello</p>
})
```

## Diagnostics

The hook and the loader see compiled JavaScript, so a diagnostic they print points
at the compiled module. `npx kirana-style check app` reads your source and points
at the line you wrote.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
