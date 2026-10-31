# Astro
Source: https://site.kirana-style.workers.dev/docs/frameworks/astro

# Astro

Declare styles in the frontmatter and apply them with `sx`. Kirana compiles the
component as it is read, before Astro does. Tested by `examples/astro`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/astro
```

## 2. Add the integration

```js file="astro.config.mjs"
import kirana from "@kirana-style/astro"
import { defineConfig } from "astro/config"

export default defineConfig({ integrations: [kirana()] })
```

Use the integration rather than `@kirana-style/vite` directly: Astro inlines small
stylesheets into its pages and links larger ones by names it records early, and
the integration is what renames the finished stylesheet by its content after Astro
has written every page.

## 3. Import the stylesheet

In your layout's frontmatter:

```astro file="src/layouts/Base.astro"
---
import "@kirana-style/core/stylesheet.css"
---
```

## 4. Type `sx`

For `astro check`:

```ts file="src/env.d.ts"
/// <reference types="@kirana-style/core/astro" />
```

## 5. Write a component

```astro file="src/components/Card.astro"
---
import { css } from "@kirana-style/core"

const { wide } = Astro.props
const card = css({ padding: "1rem", borderRadius: "0.5rem" })
const full = css({ width: "100%" })
---

<div class="card" sx={[card, wide && full]}>
  <slot />
</div>
```


The element's own `class` and `style` are merged into what `sx` produces. Islands
written in React, Preact, Solid, Vue or Svelte go through the same integration and
follow their own guides for `sx` (islands are not in the test matrix yet).

## How it compiles

The frontmatter compiles like any module, and each `sx` becomes a spread of a call
to Kirana's small runtime, evaluated when the page renders, which is at build time
for a static page. Keep `css()` calls in the frontmatter: one written inside the markup
is not compiled, and says so when it runs.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
