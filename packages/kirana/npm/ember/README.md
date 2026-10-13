# @kirana-style/ember

Kirana for Ember on Embroider and Vite (D-072): `css()` in `.gjs` and `.gts` files, and `sx` to merge
handles in templates.

```js
// vite.config.mjs — Kirana last, after Embroider's plugins
plugins: [
  classicEmberSupport(),
  ember(),
  babel({ babelHelpers: "runtime", extensions }),
  kiranaEmber(),
]
```

```js
// app/components/card.gjs
import { css } from "@kirana-style/core"
import { sx } from "@kirana-style/ember"

const styles = { card: css({ padding: "1rem" }), active: css({ outline: "2px solid" }) }

<template><div class={{sx styles.card (if @active styles.active)}}>{{yield}}</div></template>
```

`kiranaEmber()` is the Vite adapter run after Embroider, taking template-tag modules, with Ember's
own modules (`@ember/`, `@glimmer/`, `@embroider/virtual/`) as `externals`. `createSx(prefix)` makes
the helper for another `names.prefix`.
