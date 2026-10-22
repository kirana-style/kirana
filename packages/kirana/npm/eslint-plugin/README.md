# @kirana-style/eslint-plugin

<!-- consistency: subset -->

Kirana's lint rules for ESLint and Oxlint ([12-tooling-and-dx](../../../../spec/12-tooling-and-dx.md#lint)).
The rules read the compiler (its diagnostics, the atoms each style compiles to, every token, how
imports resolve) instead of re-implementing it, so lint and build never disagree.

```js
// eslint.config.js
import kirana from "@kirana-style/eslint-plugin"

export default [kirana.configs.recommended]
```

```jsonc
// .oxlintrc.json
{
  "jsPlugins": [
    { "name": "kirana", "specifier": "@kirana-style/eslint-plugin" },
  ],
  "rules": { "kirana/diagnostics": "error", "kirana/sx-last": "error" },
}
```

| Rule                        | In          | Fix         | What it reports                                                                            |
| --------------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------ |
| `diagnostics`               | recommended |             | Every compiler diagnostic (warnings and errors by default; `{ minimum, ignore }`).         |
| `sx-last`                   | recommended | autofix     | A forwarded `sx` that is not last, so callers cannot override the component.               |
| `no-conflicting-props`      | recommended |             | `className` or `style` next to `{...styleProps()}`: one replaces the other.                |
| `override-keeps-conditions` | recommended | suggestions | A plain `sx` value that loses to the component's entry under `[data-*]`/`[aria-*]`.        |
| `no-classname-on-sx`        | recommended |             | `className` given to a project component that reads `sx`: the class never reaches the DOM. |
| `no-dark-variant`           | recommended |             | A `prefers-color-scheme` condition or a Tailwind `dark:` class: use `light-dark()` tokens. |
| `no-unused`                 | recommended | suggestions | A module-local style handle or recipe option nothing applies.                              |
| `sort-properties`           | strict      | autofix     | Property order (layout, box, typography, visual) and conditions in ladder order.           |
| `prefer-token`              | strict      | suggestions | A literal equal to a token's value.                                                        |
| `finite-bridge`             | strict      |             | A runtime-bridged value only ever called with a few literals: make them variants.          |
| `no-class-helpers`          | strict      |             | An import of `clsx`, `classnames`, `tailwind-merge` or `cva`: use `cx`, `sx` or `recipe`.  |
| `restricted-properties`     | off         |             | A property, or a literal value of one, the project's options rule out.                     |
| `use-logical-properties`    | off         | suggestions | `marginLeft` and the other inline-axis sides: the logical property mirrors in RTL.         |

The project root is the nearest `kirana.config.*` above the linted file; `settings.kirana.root`
overrides it. The project is compiled once per lint run, each file once whatever the number of rules.
Results are identical under both linters; `test/parity.test.ts` proves it on every change. The rules
marked `off` are a project's own policy, in neither config; turn them on by name:

```js
{
  rules: {
    "kirana/restricted-properties": ["error", { float: { reason: "Use flex or grid." } }],
    "kirana/use-logical-properties": "warn",
  },
}
```

Biome cannot run JavaScript rules; [`@kirana-style/biome-plugin`](../biome-plugin) carries the rules
that need no compiler as GritQL plugins.
