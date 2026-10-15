# kirana-style/kirana

Kirana for PHP server templates (D-069): reads the class map `kirana-style build` and `kirana-style dev` write,
and merges named styles the way `sx` does.

- **Laravel**: the service provider is discovered; `@kirana('card', $active ? 'card.active' : null)`
  in Blade. `config('kirana.classes')` overrides the default `public/kirana/classes.json`.
- **Symfony**: register `Kirana\Twig\KiranaExtension` with the class map's path; `kirana('card')` in
  Twig. It reads the file on first use, so `cache:clear` runs before any build.
- **Anything else**: `Kirana\ClassMap::fromFile($path)->classes('card')`.

`composer run coverage` runs the tests, the merge vectors included, at 100 % of lines and methods.
