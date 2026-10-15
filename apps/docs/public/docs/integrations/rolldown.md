# Rolldown
Source: https://kirana.style/docs/integrations/rolldown

# Rolldown

Rolldown on its own does not bundle CSS, so the adapter writes the stylesheet
itself and your HTML links it. On Vite, which is Rolldown-backed and does bundle
CSS, use [the Vite plugin](/docs/integrations/vite) instead. Tested by
`examples/rolldown-react`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published. Until they are, install them from tarballs as [Installation](/docs/start/installation#install-from-tarballs) shows; the rest of this page is the same either way.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/rolldown
```

## 2. Add the plugin

```ts file="rolldown.config.mjs"
import kirana from "@kirana-style/rolldown"
import { defineConfig } from "rolldown"

export default defineConfig({
  input: "src/main.tsx",
  output: { dir: "dist" },
  plugins: [kirana()],
})
```

## 3. Link the stylesheet

Importing `@kirana-style/core/stylesheet.css` from a module gives you the stylesheet's
file name, `kirana.css` by default (`kirana({ fileName })` changes it); the
build writes it as `dist/kirana.css`.

```html file="index.html"
<link rel="stylesheet" href="/kirana.css" />
```

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [Every bundler](/docs/integrations/bundlers).
