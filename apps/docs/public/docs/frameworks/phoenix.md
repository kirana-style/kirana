# Phoenix
Source: https://kirana.style/docs/frameworks/phoenix

# Phoenix

HEEx templates name styles with `kirana/1`; the Kirana CLI writes the stylesheet
and the class map into `priv/static/kirana`. How it fits together:
[server templates](/docs/frameworks/server-templates). Tested on every change by
`examples/phoenix`, with a style edit checked on reload.

> [!NOTE] Not on npm or the language registries yet
> The packages and the template helpers are packed and tested on every change,
> but not published. Until they are, install the npm packages from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows, and the
> helper from a checkout of the repository by path; the rest of this page is the
> same either way.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/compiler
```

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
    kirana: {System, :cmd, ["npx", ~w(kirana dev assets/styles --out priv/static/kirana/kirana.css)]}
  ]
```

Add `kirana` to `Plug.Static`'s `only:` list (`static_paths/0`), and run
`npx kirana build … --minify` before `mix phx.digest` in your deploy.

## 5. Use it in HEEx

```heex file="lib/my_app_web/components/layouts/root.html.heex"
<link rel="stylesheet" href={~p"/kirana/kirana.css"} />

<div class={kirana(["card", @active && "active"])}>…</div>
```

## Next

- [Server templates](/docs/frameworks/server-templates): merging and the limits.
