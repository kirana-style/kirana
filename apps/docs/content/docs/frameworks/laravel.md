---
title: Laravel
description: Install Kirana in a Laravel app - styles in TypeScript modules, the Kirana CLI beside artisan serve, and @kirana in Blade.
section: server
order: 2
keywords: [laravel, php, blade, composer, class map, install]
---

# Laravel

Blade templates name styles with `@kirana(…)`; the Kirana CLI writes the
stylesheet and the class map into `public/kirana`. How it fits together:
[server templates](/docs/frameworks/server-templates). Tested on every change by
`examples/laravel`, served by `php artisan serve`, with a style edit checked on
reload. A React, Vue or Svelte front end (Inertia) uses [the Vite
plugin](/docs/integrations/vite) as usual.

> [!NOTE] Not on npm or the language registries yet
> The packages and the template helpers are packed and tested on every change,
> but not published. Until they are, install the npm packages from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows, and the
> helper from a checkout of the repository by path; the rest of this page is the
> same either way.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/compiler" -->

```bash
composer require kirana-style/kirana
```

Laravel discovers the package's service provider, which registers the directive.

## 2. Name the style modules

```json file="kirana.config.json"
{
  "classes": {
    "modules": ["resources/styles"],
    "out": "public/kirana/classes.json"
  }
}
```

## 3. Write styles

```ts file="resources/styles/app.styles.ts"
import { css } from "@kirana-style/core"

export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
export const active = css({ outline: "2px solid" })
```

## 4. Run the CLI beside the server

```bash
npx kirana dev resources/styles --out public/kirana/kirana.css
```

For production, `npx kirana build resources/styles --out public/kirana/kirana.css --minify`
in your deploy step.

## 5. Use it in Blade

```html file="resources/views/home.blade.php"
<link rel="stylesheet" href="{{ asset('kirana/kirana.css') }}" />

<div class="@kirana('card', $active ? 'active' : null)">…</div>
```

The class map is read from `public/kirana/classes.json`; set `kirana.classes` in
your configuration to read it from elsewhere.

## Next

- [Server templates](/docs/frameworks/server-templates): merging and the limits.
