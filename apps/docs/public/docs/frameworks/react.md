# React
Source: https://kirana.style/docs/frameworks/react

# React

`sx` compiles to `className` (and `style` for values known only at runtime).
Tested by `examples/vite-react`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin

Kirana goes before the React plugin, so React only ever sees compiled JSX:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), react()] })
```

## 3. Import the stylesheet

Once, in your entry, before your own global CSS:

```tsx file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## 4. Type `sx`

```json file="tsconfig.json"
{ "compilerOptions": { "types": ["@kirana-style/core/react"] } }
```

## 5. Write a component

```tsx file="src/button.tsx"
import { css } from "@kirana-style/core"

const styles = {
  button: css({
    paddingInline: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: { base: "#111", ":hover": "#333" },
    color: "white",
  }),
}

export function Button(props: React.ComponentProps<"button">) {
  return <button {...props} sx={styles.button} />
}
```

Run `vite`: the page is styled, and editing a value updates it without a reload.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions): what
  goes inside `css()`.
- [The Vite plugin](/docs/integrations/vite): its options and what it does in
  development and in a build.
- Not on Vite? [Other bundlers](/docs/integrations/bundlers).
