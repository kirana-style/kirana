---
title: VitePress
description: Install Kirana in a VitePress site, with the default theme's CSS in a layer below your styles, and sx in the theme's and the pages' Vue components.
section: frameworks
order: 8.5
keywords: [vitepress, vue, documentation, static site, layers, theme, install]
---

# VitePress

VitePress builds with Vite, and takes Vite plugins under `vite` in
`.vitepress/config`. Kirana compiles your theme's components and the components
pages use, written with `:sx` as in any [Vue](/docs/frameworks/vue) component.
One thing is particular to it: the default theme's CSS. Tested on every change
by `examples/vitepress`, built and on its dev server, on VitePress 2.

<!-- ::npm-status -->

VitePress 2 builds on Vite 8, which Kirana's plugin needs. VitePress 1 is on
Vite 5 and is not supported.

## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It finds the source directory (`docs/`, or the root), shows every change below
as a diff, and writes them once you say yes. Then `npx kirana-style doctor`
checks the result.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin, and layer the theme

```ts file="docs/.vitepress/config.ts"
import kirana, { cssLayer } from "@kirana-style/vite"
import { defineConfig } from "vitepress"

export default defineConfig({
  vite: {
    plugins: [
      kirana(),
      cssLayer("vitepress", "vitepress/dist/client/theme-default/"),
    ],
  },
})
```

Most of the default theme's CSS is unlayered, and its reset
(`* { padding: 0 }`) sits in a layer declared after Kirana's. Either one beats
every style you write with `css()`, whatever its selector: an unlayered rule
outranks all layered ones. `cssLayer` puts the theme's stylesheets in a
`vitepress` layer as Vite loads them, and the configuration orders it before
Kirana's ([layers](/docs/config/layers)).

## 3. Order the layer

Kirana reads its configuration from Vite's root, which VitePress makes its
source directory, so the file goes beside `.vitepress`:

```ts file="docs/kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({ layers: { before: ["vitepress"] } })
```

## 4. Import the stylesheet

In the theme's entry, before the default theme's styles:

```ts file="docs/.vitepress/theme/index.ts"
import "@kirana-style/core/stylesheet.css"
import DefaultTheme from "vitepress/theme"

export default DefaultTheme
```

## 5. Write a component

```vue file="docs/.vitepress/theme/Note.vue"
<script setup lang="ts">
import { css } from "@kirana-style/core"

const note = css({ borderLeftWidth: "3px", paddingInline: "1rem" })
</script>

<template>
  <aside :sx="note"><slot /></aside>
</template>
```

Register it in the theme's `enhanceApp`, and use `<Note>` in any page.

## Next

- [Vue](/docs/frameworks/vue): `:sx` in single-file components.
- [Layers](/docs/config/layers): where third-party CSS goes.
- [The Vite plugin](/docs/integrations/vite), and `cssLayer`.
