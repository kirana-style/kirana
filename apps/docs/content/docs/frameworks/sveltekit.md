---
title: SvelteKit
description: Install Kirana in a SvelteKit app - the Vite plugin before sveltekit(), the stylesheet in the root layout, and sx in server-rendered components.
section: frameworks
order: 10
keywords: [sveltekit, svelte, ssr, prerender, adapter, install]
---

# SvelteKit

SvelteKit compiles Svelte components with Vite, so Kirana works as it does in
[Svelte](/docs/frameworks/svelte): styles in `<script>`, `sx` on elements. Pages
rendered on the server — or prerendered — are styled from the first byte. Tested
by `examples/sveltekit`, built with `adapter-static` and run with `vite dev`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

Before SvelteKit's, so every component reaches Svelte compiled:

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), sveltekit()] })
```

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

- [Svelte](/docs/frameworks/svelte) — how `sx` compiles, and what to keep in the
  script.
- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
