# Storybook
Source: https://site.kirana-style.workers.dev/docs/integrations/storybook

# Storybook

Storybook's Vite builders (`@storybook/react-vite`, `@storybook/vue3-vite` and
the rest) read your project's `vite.config`, so a project already set up for
Kirana needs no Storybook configuration of its own for the styles: stories
compile with the same plugin, to the same class names. Tested on every change by
`examples/storybook`, built and on its dev server.

## 1. Kirana in `vite.config`

As for the app ([the Vite plugin](/docs/integrations/vite)):

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), react()] })
```

## 2. The stylesheet in the preview

Stories render in the preview's frame, which has a document of its own:

```ts file=".storybook/preview.ts"
import "@kirana-style/core/stylesheet.css"
import type { Preview } from "@storybook/react-vite"

export default {} satisfies Preview
```

## 3. Write a story

```tsx file="src/button.stories.tsx"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "./button"

export default { component: Button } satisfies Meta<typeof Button>

export const Primary: StoryObj<typeof Button> = { args: { tone: "primary" } }
```

A story for each variant of a [recipe](/docs/styling/recipes) shows every class
the variant compiles to, and editing a style updates the story on the dev server.

## Next

- [Recipes](/docs/styling/recipes): variants worth a story each.
- [Themes and modes](/docs/tokens/themes-and-modes): a toolbar switch for
  `mode.light` and `mode.dark` in the preview.
