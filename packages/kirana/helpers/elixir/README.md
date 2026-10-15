# kirana (Elixir)

Kirana for Phoenix templates (D-069): `kirana/1`, which reads the class map `kirana-style build` and
`kirana-style dev` write and merges named styles the way `sx` does.

```elixir
# lib/my_app_web.ex, in html_helpers
import Kirana, only: [kirana: 1]
```

```heex
<div class={kirana(["card", @active && "card.active"])}>…</div>
```

`config :kirana, classes: "priv/static/kirana/classes.json"` is the default. The map is cached and
read again when it changes. `mix test --cover` runs the tests, the merge vectors included, at 100 %.
