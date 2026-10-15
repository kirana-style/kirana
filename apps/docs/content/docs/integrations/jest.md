---
title: Jest
description: Kirana under Jest, through a transformer that compiles styles, then hands the module to the transformer you already use.
section: testing
order: 1
keywords: [jest, transformer, babel-jest, testing, class names]
---

# Jest

Jest runs no bundler, so Kirana is a transformer: it compiles a module's styles,
then hands it to the transformer you already use. Tests see the class names your
app ships; no stylesheet is written. Tested by `examples/jest-react`. With
Vitest, [the Vite plugin](/docs/integrations/vite) does this already.

<!-- ::npm-status -->

## 1. Install

<!-- ::install dev="@kirana-style/jest" -->

## 2. Add the transformer

```js file="jest.config.js"
export default {
  transform: {
    "\\.[jt]sx?$": ["@kirana-style/jest", { transformer: "babel-jest" }],
  },
}
```

## Caching

Jest caches a module by its own source. After changing tokens another module
reads, run Jest once with `--no-cache`.

## Next

- [Every bundler](/docs/integrations/bundlers).
