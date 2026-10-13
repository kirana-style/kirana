# kirana (Ruby)

Kirana for Rails templates (D-069): the `kirana` view helper, which reads the class map
`kirana build` and `kirana dev` write and merges named styles the way `sx` does.

```erb
<div class="<%= kirana :card, active && "card.active" %>">…</div>
```

The Railtie adds the helper to every view; `config.kirana.classes` overrides the default
`public/kirana/classes.json`. The map is read again whenever it changes. Outside Rails,
`Kirana::ClassMap.from_file(path).classes(:card)`.

`bundle exec rake test` runs the tests, the merge vectors included, at 100 % of lines and branches.
