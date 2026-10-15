---
title: PostCSS
description: The @kirana-style/postcss plugin writes the whole project's stylesheet where @kirana; stands, for pipelines whose scripts another step compiles.
section: bundlers
order: 9
keywords: [postcss, plugin, @kirana, turbopack, parcel, stylesheet]
---

# PostCSS

`@kirana-style/postcss` replaces `@kirana;` (or the stylesheet entry's placeholder) with
the project's stylesheet. It compiles every script of the project, incrementally
by modification time, and reports project-wide diagnostics as PostCSS warnings.

It writes the stylesheet only: the scripts still need Kirana's compiler to turn
`css()` into class names. That is why it comes with a script step wherever it is
used: the loader in [Next.js on Turbopack](/docs/frameworks/nextjs), the
transformer in [Parcel](/docs/integrations/parcel).

<!-- ::npm-status -->

## 1. Install

<!-- ::install dev="@kirana-style/postcss postcss" -->

## 2. Add the plugin

```js file="postcss.config.mjs"
export default { plugins: { "@kirana-style/postcss": {} } }
```

## 3. Mark where the stylesheet goes

```css file="app/globals.css"
@kirana;
```

## Options

| Option       | Default               | What it does                                          |
| ------------ | --------------------- | ----------------------------------------------------- |
| `root`       | the working directory | Where `kirana.config.*` and the project are.          |
| `minify`     | on in production      | Write minified CSS.                                   |
| `reportInfo` | `false`               | Report info diagnostics (bridged values) as warnings. |

## Next

- [Next.js](/docs/frameworks/nextjs), which uses it with Turbopack.
- [Every bundler](/docs/integrations/bundlers).
