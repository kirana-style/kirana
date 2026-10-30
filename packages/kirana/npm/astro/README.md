# @kirana-style/astro

The Astro integration for Kirana ([11-integrations](../../../../spec/11-integrations.md)).

```js
// astro.config.mjs
import kirana from "@kirana-style/astro"
import { defineConfig } from "astro/config"

export default defineConfig({ integrations: [kirana()] })
```

```astro
---
// the layout's frontmatter
import "@kirana-style/core/stylesheet.css"
---
```

What it does:

- **Compile.** It adds `@kirana-style/vite`, which compiles `.astro` components as they are read,
  before Astro does: styles declared in the frontmatter, `sx` on elements, merged with the element's
  own `class` and `style`.
- **Build.** Astro inlines small stylesheets into its pages and links larger ones by a name it records
  before the stylesheet is finished. Once every page is written, the integration fills the stylesheet
  in place, renames it by its content hash and replaces the old name in every page, chunk and
  manifest.

Options are `@kirana-style/vite`'s, except `renameStylesheet`, which the integration does itself. For
`astro check`, add `/// <reference types="@kirana-style/core/astro" />` to `src/env.d.ts`.

The guide: [kirana.style/docs/frameworks/astro](https://kirana.style/docs/frameworks/astro).
