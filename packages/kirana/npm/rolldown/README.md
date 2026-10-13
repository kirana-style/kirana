# @kirana-style/rolldown

The Rolldown adapter for Kirana ([11-integrations](../../../../spec/11-integrations.md)).

```js
// rolldown.config.mjs
import kirana from "@kirana-style/rolldown"
import { defineConfig } from "rolldown"

export default defineConfig({
  input: "src/main.tsx",
  output: { dir: "dist" },
  plugins: [kirana()],
})
```

- **Transform.** Modules that mention `@kirana-style/` or an `sx` attribute are compiled; errors fail the
  build with the source line, warnings are printed. A watch rebuild re-runs the importers of changed
  tokens and relations.
- **Stylesheet.** Rolldown does not bundle CSS, so the plugin emits the finished stylesheet as
  `kirana.css` (`kirana({ fileName })` to change it) and importing `@kirana-style/core/stylesheet.css`
  yields that name. Link it from your HTML.

Options: `root` (default: the working directory), `config` (overrides `kirana.config.*` key by key),
`reportInfo`, `fileName`. `@kirana-style/vite` is this plugin plus Vite's dev server.
