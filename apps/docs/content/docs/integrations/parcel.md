---
title: Parcel
description: Kirana on Parcel, where a transformer compiles styles in scripts and @kirana-style/postcss writes the stylesheet where @kirana; stands.
section: bundlers
order: 6
keywords: [parcel, transformer, postcss, parcelrc, zero configuration]
---

# Parcel

Parcel runs transformers in worker processes, with no step that sees every
module. So the work is split as for Next.js on Turbopack: a transformer rewrites
the styles in each script into class names, and the PostCSS plugin compiles the
whole project into the stylesheet. Tested on every change by `examples/parcel`,
built and on `parcel serve`.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/parcel-transformer @kirana-style/postcss postcss" -->

## 2. Add the transformer

```json file=".parcelrc"
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.{js,mjs,jsx,ts,tsx}": ["@kirana-style/parcel-transformer", "..."]
  }
}
```

## 3. Add the PostCSS plugin and mark the stylesheet

```json file=".postcssrc"
{ "plugins": { "@kirana-style/postcss": {} } }
```

```css file="src/kirana.css"
@kirana;
```

Link that stylesheet from your HTML, as any other.

## Next

- [PostCSS](/docs/integrations/postcss), and its options.
- [Every bundler](/docs/integrations/bundlers).
