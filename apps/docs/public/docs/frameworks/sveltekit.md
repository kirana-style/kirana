# SvelteKit
Source: https://kirana.style/docs/frameworks/sveltekit

# SvelteKit

SvelteKit compiles Svelte components with Vite, so Kirana works as it does in
[Svelte](/docs/frameworks/svelte): styles in `<script>`, `sx` on elements. Pages
rendered on the server, or prerendered, are styled from the first byte. Tested by
`examples/sveltekit`, built with the static adapter and run on the dev server.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin

Before SvelteKit's, so every component reaches Svelte compiled:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), sveltekit()] })
```

SvelteKit 3 reads its options there too, such as `sveltekit({ adapter: adapter() })`,
and no longer reads `svelte.config.js`.

## 3. Import the stylesheet

In the root layout:

```svelte file="src/routes/+layout.svelte"
<script lang="ts">
  import "@kirana-style/core/stylesheet.css"

  let { children } = $props()
</script>

{@render children()}
```

## 4. Type `sx`

```ts file="src/app.d.ts"
/// <reference types="@kirana-style/core/svelte" />
```

## 5. Write a component

```svelte file="src/lib/Card.svelte"
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

In `vite dev`, editing a style updates the page in place, without a reload.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Svelte](/docs/frameworks/svelte): how `sx` compiles, and what to keep in the
  script.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
