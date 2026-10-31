# Laravel
Source: https://site.kirana-style.workers.dev/docs/frameworks/laravel

# Laravel

Blade templates name styles with `@kirana(…)`; the Kirana CLI writes the
stylesheet and the class map into `public/kirana`. How it fits together:
[server templates](/docs/frameworks/server-templates). Tested on every change by
`examples/laravel`, served by `php artisan serve`, with a style edit checked on
reload. A React, Vue or Svelte front end (Inertia) uses [the Vite
plugin](/docs/integrations/vite) as usual.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D kirana-style
```

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
npx kirana-style dev resources/styles --out public/kirana/kirana.css
```

For production, `npx kirana-style build resources/styles --out public/kirana/kirana.css --minify`
in your deploy step.

## 5. Use it in Blade

```html file="resources/views/home.blade.php"
<link rel="stylesheet" href="{{ asset('kirana/kirana.css') }}" />

<div class="@kirana('card', $active ? 'active' : null)">…</div>
```

The class map is read from `public/kirana/classes.json`; set `kirana.classes` in
your configuration to read it from elsewhere.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Server templates](/docs/frameworks/server-templates): merging and the limits.
