# Publishing a library
Source: https://kirana.style/docs/advanced/libraries

# Publishing a library

A Kirana library publishes its styles **uncompiled**, and each app that uses it
compiles them together with its own. That is what lets an app override a
library's style property by property, keeps every declaration in the stylesheet
once, and applies the app's prefix, targets and layers to the library too.

Tested by `examples/vite-library`, which installs a packed library from a tarball.

<!-- ::figure-library -->

## In the library

Build your package without Kirana's plugin — `tsc`, `tsdown` or any bundler — so
the `css()` calls stay in the published JavaScript, and ship no CSS:

```js file="acme-ui/index.js"
import { css, props } from "@kirana-style/core"
import { jsx } from "react/jsx-runtime"

const styles = {
  button: css({ paddingInline: "1rem", borderRadius: "0.5rem" }),
}

export function Button({ sx, ...rest }) {
  return jsx("button", { ...rest, ...props(styles.button, sx) })
}
```

Apply styles with `props()` (or `cx` into `className`): both compile in plain
JavaScript. `sx` needs JSX, which a library's build usually compiles away; ship
`.jsx` or `.tsx` if you want to keep it.

Make `@kirana-style/core` a peer dependency, so the library and the app share one.

## In the app

List the package:

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({ libraries: ["acme-ui"] })
```

Its modules are now compiled from `node_modules` like your own, and its exported
tokens work in your styles. With Vite nothing else is needed — the adapter keeps
listed libraries out of dependency pre-bundling and server externals. With
Next.js, also add the package to `transpilePackages`.

## Why not ship compiled CSS

A library compiled on its own bakes its compiler version and configuration into
its class names. With a different prefix, an app's override can no longer replace
the library's value — both classes stay, and whichever rule comes later in the
stylesheet wins. With an older compiler, the same declaration ships twice. The
reasoning, with the measurements, is in the design note
`packages/kirana/design-notes/published-libraries.md`.

The one cost: an app that does not use Kirana cannot use a Kirana library.
