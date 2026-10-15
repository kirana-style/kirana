# Svelte
Source: https://kirana.style/docs/frameworks/svelte

# Svelte

Declare styles in the component's `<script>` and apply them with `sx`. Kirana
compiles the component as it is read, before Svelte does. Tested by
`examples/vite-svelte`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin

Kirana goes before Svelte's plugin:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), svelte()] })
```

## 3. Import the stylesheet

```ts file="src/main.ts"
import "@kirana-style/core/stylesheet.css"
```

## 4. Type `sx`

For `svelte-check`:

```ts file="src/env.d.ts"
/// <reference types="@kirana-style/core/svelte" />
```

## 5. Write a component

```svelte file="src/Card.svelte"
<script lang="ts">
  import { css } from "@kirana-style/core"

  let { wide, children } = $props()

  const card = css({ padding: "1rem", borderRadius: "0.5rem" })
  const full = css({ width: "100%" })
</script>

<div class="card" sx={[card, wide && full]}>
  {@render children?.()}
</div>
```

The element's own class and style attributes are merged into what `sx` produces,
in order, and `class:` and `style:` directives keep working beside it.

## How it compiles

The script compiles like any module: `css()` becomes class strings, and the
stylesheet gets the atoms. Each `sx` becomes a spread of a call to Kirana's small
runtime, which merges the styles as the component renders, so a condition like
`wide && full` stays reactive. Keep `css()` calls in the script: one written
inside the markup is not compiled, and says so when it runs.

## SvelteKit

On SvelteKit, follow the [SvelteKit guide](/docs/frameworks/sveltekit): the
plugin goes before `sveltekit()`, and the stylesheet in the root layout.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
