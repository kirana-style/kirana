# Nuxt
Source: https://site.kirana-style.workers.dev/docs/frameworks/nuxt

# Nuxt

Nuxt compiles Vue components with Vite, so Kirana works as it does in
[Vue](/docs/frameworks/vue): styles in `<script setup>`, `:sx` in the template.
Pages rendered on the server and hydrated in the browser are styled from the first
byte. Tested by `examples/nuxt`, built as a static site and run on the dev
server.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Configure Nuxt

Add the plugin to Nuxt's Vite configuration, and the stylesheet to its global CSS:

```ts file="nuxt.config.ts"
import kirana from "@kirana-style/vite"

export default defineNuxtConfig({
  css: ["@kirana-style/core/stylesheet.css"],
  vite: { plugins: [kirana()] },
})
```

## 3. Type `:sx`

```ts file="app/kirana.d.ts"
/// <reference types="@kirana-style/core/vue" />
```

## 4. Write a component

```vue file="app/components/Card.vue"
<script setup lang="ts">
import { css } from "@kirana-style/core"

defineProps<{ wide: boolean }>()

const card = css({ padding: "1rem", borderRadius: "0.5rem" })
const full = css({ width: "100%" })
</script>

<template>
  <div class="card" :sx="[card, wide && full]"><slot /></div>
</template>
```

In `nuxt dev`, editing a style updates the page in place, without a reload.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Vue](/docs/frameworks/vue): how `:sx` compiles, and what to keep in the script.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
