---
title: Ember.js
description: Install Kirana in an Ember app on Embroider and Vite, with css() in .gjs and .gts files and the sx helper in templates.
section: frameworks
order: 13.5
keywords: [ember, embroider, vite, gjs, gts, template tag, glimmer, helper]
---

# Ember.js

Ember's template-tag components (`.gjs`, `.gts`) hold a `<template>` next to
their JavaScript. Kirana's plugin runs after Embroider has turned them into
JavaScript, so `css()` works in them as anywhere else, and templates reach the
handles in scope.

The `sx` helper merges them, later ones winning. Tested on
every change by `examples/ember`, built and on its dev server.

<!-- ::npm-status -->

## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects the project, shows every change below as a diff, writes them once you
say yes, and prints the install command (`--install` runs it). Then
`npx kirana-style doctor` checks the result.

## 1. Install

<!-- ::install packages="@kirana-style/core @kirana-style/ember" dev="@kirana-style/vite" -->

## 2. Add the plugin

Kirana goes last, after Embroider's plugins:

```js file="vite.config.mjs"
import { kiranaEmber } from "@kirana-style/ember/vite"
import { classicEmberSupport, ember, extensions } from "@embroider/vite"
import { babel } from "@rollup/plugin-babel"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    babel({ babelHelpers: "runtime", extensions }),
    kiranaEmber(),
  ],
})
```

The Ember plugin also tells the compiler that `@ember/`, `@glimmer/` and
`@embroider/virtual/` are modules only Embroider resolves
([`externals`](/docs/reference/config)).

## 3. Import the stylesheet

```js file="app/app.js"
import "@kirana-style/core/stylesheet.css"
```

## 4. Write a component

```js file="app/components/card.gjs"
import { css } from "@kirana-style/core"
import { sx } from "@kirana-style/ember"

const styles = {
  card: css({ padding: "1rem", borderRadius: "0.5rem" }),
  active: css({ outline: "2px solid" }),
}

<template>
  <div class={{sx styles.card (if @active styles.active)}}>{{yield}}</div>
</template>
```

`sx` is a plain function, which Ember calls as a helper. It merges the handles
with Kirana's runtime, the way an `sx` list does at build time elsewhere. A
value known only at runtime carries custom properties a class cannot hold; set it
from the component's code.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [merging](/docs/styling/merging).
- [The Vite plugin](/docs/integrations/vite).
