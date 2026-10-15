# Solid
Source: https://kirana.style/docs/frameworks/solid

# Solid

`sx` compiles to `class` (and a style attribute for values known only at
runtime). Kirana picks that up from the JSX import source in your `tsconfig.json`,
so there is nothing to configure. Tested by `examples/vite-solid`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin

Kirana goes before the Solid plugin, so Solid only ever sees compiled JSX:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import solid from "vite-plugin-solid"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), solid()] })
```

## 3. Point `jsxImportSource` at Solid, and type `sx`

```json file="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["@kirana-style/core/solid"]
  }
}
```

Without a `tsconfig.json`, set [`jsx: "solid"`](/docs/config/reference) in
`kirana.config.ts` instead.

## 4. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```tsx file="src/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })
const wide = css({ width: "100%" })

export const Card = (props: { wide: boolean }) => (
  <div class="card" sx={[card, props.wide && wide]} />
)
```

A `class` already on the element is merged with the styles into the one `class`
it ends up with, and so is a `className`.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [The Vite plugin](/docs/integrations/vite).
