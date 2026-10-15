---
title: Phoenix
description: Install Kirana in a Phoenix app, with styles in TypeScript modules, the Kirana CLI as a watcher, and kirana/1 in HEEx.
section: server
order: 5
keywords: [phoenix, elixir, heex, hex, mix, class map, install]
---

# Phoenix

HEEx templates name styles with `kirana/1`; the Kirana CLI writes the stylesheet
and the class map into `priv/static/kirana`. How it fits together:
[server templates](/docs/frameworks/server-templates). Tested on every change by
`examples/phoenix`, with a style edit checked on reload.

<!-- ::npm-status kind="helpers" -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="kirana-style" -->

```elixir file="mix.exs"
defp deps do
  [
    # …
    {:kirana, "~> 0.1"}
  ]
end
```

## 2. Import the helper

```elixir file="lib/my_app_web.ex"
defp html_helpers do
  quote do
    # …
    import Kirana, only: [kirana: 1]
  end
end
```

## 3. Name the style modules and write styles

```json file="kirana.config.json"
{
  "classes": {
    "modules": ["assets/styles"],
    "out": "priv/static/kirana/classes.json"
  }
}
```

```ts file="assets/styles/app.styles.ts"
import { css } from "@kirana-style/core"

export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
```

## 4. Run the CLI as a watcher

```elixir file="config/dev.exs"
config :my_app, MyAppWeb.Endpoint,
  watchers: [
    kirana: {System, :cmd, ["npx", ~w(kirana-style dev assets/styles --out priv/static/kirana/kirana.css)]}
  ]
```

Add `kirana` to the `only:` list of `Plug.Static` (in `static_paths/0`).

In your deploy, run `npx kirana-style build … --minify` before `mix phx.digest`.

## 5. Use it in HEEx

```heex file="lib/my_app_web/components/layouts/root.html.heex"
<link rel="stylesheet" href={~p"/kirana/kirana.css"} />

<div class={kirana(["card", @active && "active"])}>…</div>
```

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Server templates](/docs/frameworks/server-templates): merging and the limits.
