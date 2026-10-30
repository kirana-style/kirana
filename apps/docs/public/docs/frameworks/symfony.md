# Symfony
Source: https://kirana.style/docs/frameworks/symfony

# Symfony

Twig templates name styles with `kirana(…)`; the Kirana CLI writes the
stylesheet and the class map into `public/kirana`. How it fits together:
[server templates](/docs/frameworks/server-templates). Tested on every change by
`examples/symfony`, with a style edit checked on reload.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D kirana-style
```

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
use, so `cache:clear` works before the first `kirana-style build`.

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
npx kirana-style dev resources/styles --out public/kirana/kirana.css
```

`kirana-style build resources/styles --out public/kirana/kirana.css --minify` writes
both files once, for production.

## 5. Use it in Twig

```twig file="templates/home.html.twig"
<link rel="stylesheet" href="{{ asset('kirana/kirana.css') }}">

<div class="{{ kirana('card', active ? 'active') }}">…</div>
```

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Server templates](/docs/frameworks/server-templates): merging and the limits.
