---
title: Meteor
description: Install Kirana in a Meteor 3.4+ app - Meteor bundles app code with Rspack, and Kirana's Rspack plugin goes in its configuration.
section: frameworks
order: 13.7
keywords: [meteor, rspack, react, install, modern build stack]
---

# Meteor

Since Meteor 3.4 the `rspack` package bundles app code with Rspack, so Kirana's
Rspack plugin is Meteor's plugin too. Tested on every change by
`examples/meteor`, built with `meteor build` and on `meteor run`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## The fast way

In the project's root:

```bash
npx kirana init
```

It detects the project, shows every change below as a diff, writes them once you
say yes, and prints the install command (`--install` runs it). Then
`npx kirana doctor` checks the result.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/rspack" -->

## 2. Add the plugin

```js file="rspack.config.js"
const { defineConfig } = require("@meteorjs/rspack")
const { KiranaPlugin } = require("@kirana-style/rspack")

module.exports = defineConfig(() => ({ plugins: [new KiranaPlugin()] }))
```

## 3. Tell Kirana about Meteor's modules

`meteor/meteor` and the other `meteor/` modules exist only in Meteor's bundler:

```json file="kirana.config.json"
{ "externals": ["meteor/"] }
```

## 4. Import the stylesheet

```jsx file="client/main.jsx"
import "@kirana-style/core/stylesheet.css"
```

## 5. Write a component

```jsx file="imports/ui/App.jsx"
import { css } from "@kirana-style/core"

const title = css({ fontSize: "2rem", fontWeight: 600 })

export const App = () => <h1 sx={title}>Hello</h1>
```

## Notes

- Meteor turns on Rspack's persistent cache, so a build can restore modules
  without running loaders. Kirana compiles those from disk before it writes the
  stylesheet, so a cached build is complete.
- Kirana resolves imports as Node.js does: Meteor's root-relative
  `/imports/ui/App` is a runtime value to it. Import styles relatively, or through
  `paths` in `tsconfig.json`.

## Next

- [Rspack and Rsbuild](/docs/integrations/rspack).
- [Styles](/docs/styling/styles).
