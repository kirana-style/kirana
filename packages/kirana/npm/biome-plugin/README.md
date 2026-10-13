# @kirana-style/biome-plugin

Kirana's lint rules for [Biome](https://biomejs.dev), as GritQL plugins
([12-tooling-and-dx](../../../../spec/12-tooling-and-dx.md#lint)).

```jsonc
// biome.json
{
  "extends": ["@kirana-style/biome-plugin/recommended"],
}
```

`@kirana-style/biome-plugin/strict` adds `no-class-helpers`. The presets name the rule files as
`./node_modules/@kirana-style/biome-plugin/rules/*.grit`, because Biome resolves a plugin path from the
project, not from the configuration that lists it. If the package is not installed in the
`node_modules` next to `biome.json` (in a workspace member, say), list the files from where it is:

```jsonc
{
  "plugins": [
    "../../node_modules/@kirana-style/biome-plugin/rules/sx-last.grit",
    "../../node_modules/@kirana-style/biome-plugin/rules/no-conflicting-props.grit",
    "../../node_modules/@kirana-style/biome-plugin/rules/no-dark-variant.grit",
  ],
}
```

| Rule                   | In          | What it reports                                                                            |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `sx-last`              | recommended | A forwarded `sx` that is not last, so callers cannot override the component.               |
| `no-conflicting-props` | recommended | `className` or `style` next to `{...styleProps()}`: one replaces the other.                |
| `no-dark-variant`      | recommended | A `prefers-color-scheme` condition or a Tailwind `dark:` class: use `light-dark()` tokens. |
| `no-class-helpers`     | strict      | An import of `clsx`, `classnames`, `tailwind-merge` or `cva`: use `cx`, `sx` or `recipe`.  |

Each message starts with the rule's name (`kirana/sx-last: …`); Biome reports plugin diagnostics
under one category, `plugin`.

## What Biome cannot run

A Biome plugin matches syntax. It cannot call the compiler or read another file, so the rules of
[`@kirana-style/eslint-plugin`](../eslint-plugin) that do are not here:

<!-- consistency: subset -->

| Rule                                                                               | Instead, under Biome                                      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `diagnostics`                                                                      | `kirana check --format github --max-warnings 0` in CI     |
| `override-keeps-conditions`, `no-classname-on-sx`, `prefer-token`, `finite-bridge` | the language server in the editor; ESLint or Oxlint in CI |
| `no-unused`, `sort-properties`                                                     | ESLint or Oxlint: GritQL cannot count reads or order keys |

The plugins also match names, not imports: `styleProps` is the documented local name of
`@kirana-style/core`'s `props`, and `css`, `recipe` and `media` are matched as written.

## Versions

<!-- consistency: subset -->

Biome's GritQL grammar can change between releases. The rules are tested against the Biome version
pinned in this repository's catalog; `test/biome.test.ts` runs every rule through Biome and through
its ESLint original, and the reports — line, column and message — must match.
