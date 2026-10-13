---
title: Symfony
description: Install Kirana in a Symfony app - styles in TypeScript modules, the Kirana CLI, and kirana() in Twig.
section: server
order: 3
keywords: [symfony, php, twig, composer, class map, install]
---

# Symfony

Twig templates name styles with `kirana(…)`; the Kirana CLI writes the
stylesheet and the class map into `public/kirana`. How it fits together:
[server templates](/docs/frameworks/server-templates). Tested on every change by
`examples/symfony`, with a style edit checked on reload.

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

## 2. Register the Twig function

```yaml file="config/services.yaml"
services:
  Kirana\Twig\KiranaExtension:
    arguments: ["%kernel.project_dir%/public/kirana/classes.json"]
```

Autoconfiguration tags it as a Twig extension. It reads the class map on first
use, so `cache:clear` works before the first `kirana build`.

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
npx kirana dev resources/styles --out public/kirana-style/kirana.css
```

`kirana build --minify` writes both files once, for production.

## 5. Use it in Twig

```twig file="templates/home.html.twig"
<link rel="stylesheet" href="{{ asset('kirana-style/kirana.css') }}">

<div class="{{ kirana('card', active ? 'active') }}">…</div>
```

## Next

- [Server templates](/docs/frameworks/server-templates): merging and the limits.
