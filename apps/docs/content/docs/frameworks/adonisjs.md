---
title: AdonisJS
description: Install Kirana in an AdonisJS app - styles in TypeScript modules, the Kirana CLI, and kirana() in Edge templates.
section: server
order: 6
keywords: [adonisjs, adonis, edge, node.js, class map, install]
---

# AdonisJS

Edge templates name styles with `kirana(…)`, a global `@kirana-style/adonis` registers;
the Kirana CLI writes the stylesheet and the class map into `public/kirana`. How
it fits together: [server templates](/docs/frameworks/server-templates). Tested on
every change by `examples/adonisjs`, with a style edit checked on reload. An
Inertia front end uses [the Vite plugin](/docs/integrations/vite) as usual.

> [!NOTE] Not on npm or the language registries yet
> The packages and the template helpers are packed and tested on every change,
> but not published. Until they are, install the npm packages from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows, and the
> helper from a checkout of the repository by path; the rest of this page is the
> same either way.

## The fast way

In the project's root:

```bash
npx kirana init
```

It adds the provider, the configuration and a style module, shows each as a diff,
and prints the install command.

## 1. Install

<!-- ::install packages="@kirana-style/core @kirana-style/adonis" dev="@kirana-style/compiler" -->

## 2. Register the provider

```ts file="adonisrc.ts"
providers: [
  // …
  () => import("@kirana-style/adonis/provider"),
],
```

## 3. Name the style modules and write styles

```json file="kirana.config.json"
{
  "classes": {
    "modules": ["resources/styles"],
    "out": "public/kirana/classes.json"
  }
}
```

```ts file="resources/styles/app.styles.ts"
import { css } from "@kirana-style/core"

export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
```

## 4. Run the CLI

```bash
npx kirana dev resources/styles --out public/kirana/kirana.css
```

## 5. Use it in Edge

```html file="resources/views/pages/home.edge"
<link rel="stylesheet" href="/kirana/kirana.css" />

<div class="{{ kirana('card', active && 'active') }}">…</div>
```

The global reads the class map again whenever `kirana dev` rewrites it.

## Next

- [Server templates](/docs/frameworks/server-templates): merging and the limits.
