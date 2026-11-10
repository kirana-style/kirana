---
title: Svelte
description: Install Kirana in a Svelte app on Vite, with styles in the script and sx on elements, compiled before Svelte sees the component.
section: frameworks
order: 9
keywords: [svelte, svelte 5, vite, runes, class, install]
---

# Svelte

Declare styles in the component's `<script>` and apply them with `sx`. Kirana
compiles the component as it is read, before Svelte does. Tested by
`examples/vite-svelte`.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

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

What `sx` produces merges, in this order:

1. the element's own styles, from `sx`;
2. the classes and styles it is given, in the order they are written: its own
   `class` and `style` attributes, and those of a spread written before it
   (`{...props()}`, as Ark UI's `asChild` hands its child its props).

A later one wins, as it would without Kirana. A spread after the `sx` is left
alone and overrides it, as written. Directives (`class:`, `style:`) keep working
beside it.

## A component that takes `sx`

On a component, a caller's `sx` arrives as its `class` and `style` props. Pass the
class to the root beside its own styles: they merge first and the caller's class
last, so the caller's styles win, property by property:

```svelte file="src/Button.svelte"
<script lang="ts">
  import { css } from "@kirana-style/core"
  import type { HTMLButtonAttributes } from "svelte/elements"

  let { class: className, children, ...rest }: HTMLButtonAttributes = $props()

  const button = css({ height: "2rem", backgroundColor: "black" })
</script>

<button {...rest} class={className} sx={button}>
  {@render children?.()}
</button>
```

`class` keeps Svelte's own type, so an array or an object of conditions works
there too, and the caller's `style` reaches the button through the spread.
Svelte passes nothing through on its own, so there is no fallthrough to turn off.
A caller's removals (`"*": null`, `padding: null`) arrive in the class too, and
the root's merge applies them to the button's own entries.

The root can be another component, such as a headless library's part, written the
same way. A relation's anchor in its `sx` counts even when the script imports
nothing from Kirana.

## How it compiles

The script compiles like any module: `css()` becomes class strings, and the
stylesheet gets the atoms. Each `sx` becomes a spread of a call to Kirana's small
runtime, which merges the styles as the component renders, so a condition like
`wide && full` stays reactive. Keep `css()` calls in the script: one written
inside the markup is not compiled, and says so when it runs.

`props()` and `cx()` imported in the script can be called in the markup: the
build defines them there from the same runtime.

## SvelteKit

On SvelteKit, follow the [SvelteKit guide](/docs/frameworks/sveltekit): the
plugin goes before `sveltekit()`, the stylesheet in the root layout, and the
classes `<html>` takes in a server hook, since `src/app.html` is static.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
