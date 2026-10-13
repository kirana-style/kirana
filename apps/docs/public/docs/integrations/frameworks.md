# Frameworks
Source: https://kirana.style/docs/integrations/frameworks

# Frameworks

`sx` is not a framework feature: the compiler rewrites it into the attribute the
framework reads, so the same styles work in all of them and produce the same
atoms.

| Framework    | `sx` becomes                 | Types to reference    |
| ------------ | ---------------------------- | --------------------- |
| React        | `className` and `style`      | `@kirana-style/core/react`  |
| Preact       | `class` and `style`          | `@kirana-style/core/preact` |
| Solid        | `class` and `style`          | `@kirana-style/core/solid`  |
| No framework | nothing to rewrite: use `cx` | —                     |

## Which one the compiler picks

You rarely say. The compiler reads `jsxImportSource` from your `tsconfig.json`:

```json file="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["@kirana-style/core/solid"]
  }
}
```

`"preact"` selects Preact, `"solid-js"` selects Solid, and anything else — or no
`tsconfig.json` — means React. To choose explicitly, set
[`jsx`](/docs/config/reference) in `kirana.config.ts`.

## Preact and Solid

Write `sx` exactly as in React:

```tsx file="src/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })

export const Card = (props: { wide: boolean }) => (
  <div class="card" sx={[card, props.wide && css({ width: "100%" })]} />
)
```

A `class` already on the element is merged with the styles, in order, into the
one `class` it ends up with, and so is a `className` (Preact code often still has
one).
Values known only at runtime still become custom properties in `style`, which
both frameworks set as written.

Put the Kirana plugin before the framework's own — `plugins: [kirana(), preact()]`
or `[kirana(), solid()]` — so the framework only ever sees compiled JSX.

## No framework

A style handle is a class string, and `cx` merges handles the way `sx` does:

```ts file="src/main.ts"
import { css, cx } from "@kirana-style/core"

const button = css({ padding: "0.5rem 1rem" })
const primary = css({ backgroundColor: "black", color: "white" })

element.className = String(cx(button, primary))
```

That is all a web component or a server template needs.

Each of these is built and checked in a browser on every change: see
`examples/vite-preact`, `examples/vite-solid` and `examples/vite-vanilla`.
