# @kirana-style/adonis

Kirana for AdonisJS (D-069): `kirana()` in Edge templates, merging styles named from the class map
`kirana build` and `kirana dev` write.

```ts
// adonisrc.ts
providers: [() => import("@kirana-style/adonis/provider")]
```

```html
<div class="{{ kirana('card', active && 'card.active') }}">…</div>
```

The class map is read from `config/kirana.ts`'s `classes`, by default `public/kirana/classes.json`,
and again whenever it changes. How class maps work: `design-notes/class-maps.md`.
