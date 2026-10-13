---
title: Vue
description: Install Kirana in a Vue app on Vite - styles in the script, :sx in the template, compiled before Vue sees the component.
section: frameworks
order: 7
keywords: [vue, vite, sfc, script setup, v-bind, class, install]
---

# Vue

Declare styles in `<script setup>` and apply them with `:sx`. Kirana compiles the
component as it is read, before Vue does. Tested by `examples/vite-vue`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

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

## How it compiles

The script compiles like any module — `css()` becomes class strings, and the
stylesheet gets the atoms. Each `:sx` becomes
`v-bind="…"` with a call to Kirana's small runtime, which merges the styles when
the component renders. Keep `css()` calls in the script: one written inside the
template is not compiled, and says so when it runs.

## Nuxt

On Nuxt, follow the [Nuxt guide](/docs/frameworks/nuxt): the plugin goes in
`nuxt.config.ts` instead.
