# @kirana-style/remix

Kirana for Remix 3. Remix compiles TypeScript and JSX itself, with `node-tsx` on the server and
in its asset server for the browser, and hands on only the JavaScript that comes out; Kirana
compiles the styles after both, on the compiled JSX calls, in one session per server process.

```json
"start": "node --import remix/node-tsx --import @kirana-style/remix/node server.ts"
```

```ts
import { kiranaLoader, stylesheet } from "@kirana-style/remix"

createAssetServer({
  allowPackages: ["remix", "@kirana-style/core"],
  scripts: { loaders: [kiranaLoader] },
})
createRouter({ middleware: [stylesheet(), renderMiddleware] }) // serves /kirana.css
```

Link `/kirana.css` from the document, and type `sx` with `@kirana-style/core/remix`. The guide:
https://kirana.style/docs/frameworks/remix
