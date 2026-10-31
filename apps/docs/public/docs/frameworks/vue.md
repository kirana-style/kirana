# Vue
Source: https://site.kirana-style.workers.dev/docs/frameworks/vue

# Vue

Declare styles in `<script setup>` and apply them with `:sx`. Kirana compiles the
component as it is read, before Vue does. Tested by `examples/vite-vue`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## 2. Add the plugin

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), vue()] })
```

## 3. Import the stylesheet

```ts file="src/main.ts"
import "@kirana-style/core/stylesheet.css"
```

## 4. Type `:sx`

For `vue-tsc` and the Vue language tools:

```ts file="src/env.d.ts"
/// <reference types="@kirana-style/core/vue" />
```

## 5. Write a component

```vue file="src/Card.vue"
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

`:sx` takes what `sx` takes anywhere: a style, a list, conditionals. Vue merges
the result with the element's own `class` and `style`.

## A component that takes `:sx`

On a component, a caller's `:sx` arrives as the `class` Vue falls through to its
root, where Vue adds it beside the root's own classes: two classes for one
property, and the stylesheet's order picks one. To let the caller's styles win,
property by property, turn the fallthrough off and put them last in the root's own
`:sx`, with `useSx()`:

```vue file="src/Button.vue"
<script setup lang="ts">
import { css } from "@kirana-style/core"
import { useSx } from "@kirana-style/core/vue"

defineOptions({ inheritAttrs: false })
const { sx, attrs } = useSx()

const button = css({ height: "2rem", backgroundColor: "black" })
</script>

<template>
  <button v-bind="attrs" :sx="[button, sx]"><slot /></button>
</template>
```

`sx` is the caller's classes, and `attrs` every other attribute it passed:
listeners, `aria-*` and its inline style, bound on the same element. Then
`<Button :sx="tall">` gives the button one class per property, the caller's where
both set one.

## How it compiles

The script compiles like any module: `css()` becomes class strings, and the
stylesheet gets the atoms. Each `:sx` becomes
`v-bind="…"` with a call to Kirana's small runtime, which merges the styles when
the component renders. Keep `css()` calls in the script: one written inside the
template is not compiled, and says so when it runs.

An element takes one object binding, so an element's own `v-bind` object is
merged into the compiled one with Vue's `mergeProps`.

A component imported from a workspace package, outside the app's root, compiles
and hot-reloads like one inside it.

## Nuxt

On Nuxt, follow the [Nuxt guide](/docs/frameworks/nuxt): the plugin goes in
`nuxt.config.ts` instead.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
