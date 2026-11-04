# Electron
Source: https://site.kirana-style.workers.dev/docs/frameworks/electron

# Electron

An Electron app has a main process with no page and a renderer that shows one.
electron-vite builds the renderer with Vite, so Kirana's Vite plugin goes in the
renderer's config. Tested by `examples/electron`, whose renderer is built and
checked in Chromium.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin to the renderer

Kirana goes before the React plugin, so React only ever sees compiled JSX. The
main process renders nothing, so it gets no plugin:

```ts file="electron.vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "electron-vite"

export default defineConfig({
  main: {},
  preload: {},
  renderer: { plugins: [kirana(), react()] },
})
```

## 3. Type `sx`

```json file="tsconfig.web.json"
{
  "compilerOptions": {
    "types": ["@kirana-style/core/react"]
  }
}
```

electron-vite's templates split the TypeScript config: the renderer's is
`tsconfig.web.json`.

## 4. Import the stylesheet

```ts file="src/renderer/src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```tsx file="src/renderer/src/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })

export const Card = () => <div sx={card} />
```

`electron-vite dev` serves the renderer from Vite's dev server, so styles update as
you save. `electron-vite build` writes the stylesheet into `out/renderer`, which
the app loads from disk.

Electron ships its own Chromium, far above Kirana's default floor, so there is no
[target](/docs/frameworks/desktop#set-targets-to-the-oldest-engine-you-support) to
set.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [React](/docs/frameworks/react), for `sx` and `className` in components.
- [The Vite plugin](/docs/integrations/vite).
