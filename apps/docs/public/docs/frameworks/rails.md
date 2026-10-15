# Ruby on Rails
Source: https://kirana.style/docs/frameworks/rails

# Ruby on Rails

ERB views name styles with the `kirana` helper, which the gem's Railtie puts in
every view; the Kirana CLI writes the stylesheet and the class map. How it fits
together: [server templates](/docs/frameworks/server-templates). Tested on every
change by `examples/rails`, served by Puma, with a style edit checked on reload.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D kirana-style
```

```ruby file="Gemfile"
gem "kirana"
```

## 2. Name the style modules and write styles

```json file="kirana.config.json"
{
  "classes": { "modules": ["app/styles"], "out": "public/kirana/classes.json" }
}
```

```ts file="app/styles/app.styles.ts"
import { css } from "@kirana-style/core"

export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
```

## 3. Run the CLI with the server

```bash file="Procfile.dev"
web: bin/rails server
kirana: npx kirana-style dev app/styles --out public/kirana/kirana.css
```

For production, run `npx kirana-style build app/styles --out public/kirana/kirana.css --minify`
before `assets:precompile`.

## 4. Use it in a view

```erb file="app/views/home/index.html.erb"
<link rel="stylesheet" href="/kirana/kirana.css">

<div class="<%= kirana :card, active && :active %>">…</div>
```

The helper reads the class map again whenever `kirana-style dev` rewrites it. Set
`config.kirana.classes` to read it from somewhere other than
`public/kirana/classes.json`.

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Server templates](/docs/frameworks/server-templates): merging and the limits.
