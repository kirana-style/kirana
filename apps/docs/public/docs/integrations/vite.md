# Vite
Source: https://kirana.style/docs/integrations/vite

# Vite

`@kirana-style/vite` is the adapter for Vite 8 and Rolldown. It owns a compiler session,
compiles the modules that carry styles, serves the stylesheet in development and
writes it in a build.

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"

export default defineConfig({
  plugins: [kirana(), react()],
})
```

**Order matters.** Kirana runs `pre`, before the framework plugin, so React (or
anything else) only ever sees compiled JavaScript.

## Options

```ts
kirana({
  // Overrides kirana.config.ts, key by key.
  config: { names: { prefix: "app" } },
  // Surface info-level diagnostics (bridged values, lowered targets) in the terminal.
  reportInfo: true,
  // Shorter class names in a production build (below).
  names: "dense",
})
```

All are optional, and most projects pass nothing: the plugin finds
`kirana.config.*` in the Vite root on its own.

## Dense names

With `names: "dense"`, a production build replaces the two hashes in every
class name with codes of one or two characters, assigned from the whole build:
`k50-KFHz_D9ur` becomes something like `k50-b_a`.

- **The development server keeps the hashed names.** So do the language
  server and `kirana-style trace`.
- **Only names the compiler wrote are renamed.** A string that merely looks like
  a class name, such as an example on a documentation page, is left alone.
- **The client and server bundles agree.** Both are renamed from one map, and
  the stylesheet with them.

It is off by default while it is measured on more applications; see
[dense names](/docs/advanced/output#dense-names) for what it saves. It cannot be
combined with a [class map](/docs/frameworks/server-templates), whose server-side
helpers read hashed names, and the build says so.

## Which modules it compiles

Script files only (TypeScript and JavaScript, with or without JSX, ES modules
included) outside `node_modules`, and only when the text contains `@kirana-style/`
or an `sx` attribute.
That prefilter is why adding Kirana to a large application does not slow the build
down in proportion to its size.

Markdown, HTML and other assets are never compiled, so `sx` written there does
nothing. Neither are the modules a plugin generates rather than reads from a file
(`virtual:` ids, and Rollup's null-prefixed ones), even when their id ends in a
script extension: they hold that plugin's code, never your styles.

## A dependency's CSS in a layer

`cssLayer(name, include)` puts a dependency's stylesheets in a cascade layer as
Vite loads them: every stylesheet whose path contains `include`, or matches it
when it is a regular expression. It is for a package that imports unlayered CSS
from JavaScript, where there is no import line to give a layer. Unlayered, a
theme's reset would beat every style you write.

```ts file="vite.config.ts"
import kirana, { cssLayer } from "@kirana-style/vite"

export default defineConfig({
  plugins: [kirana(), cssLayer("vendor", "some-theme/dist/")],
})
```

Then order the layer before Kirana's, `layers: { before: ["vendor"] }`
([layers](/docs/config/layers)). `@charset` and `@import` stay at the top of a
wrapped file, and an import without a layer of its own takes the same one.
[VitePress](/docs/frameworks/vitepress) uses it for its default theme.

## The stylesheet

Import the entry once, in your entry; a framework that renders the document as a
component imports it as a URL for its `<link>`:

```tsx
import "@kirana-style/core/stylesheet.css"
// or, for <link rel="stylesheet" href={kiranaCss} /> in a document component:
import kiranaCss from "@kirana-style/core/stylesheet.css?url"
```

- **In development** the plugin serves the live stylesheet and pushes updates
  over Vite's hot channel, so a style change restyles the page without a reload.
- **In a build** it replaces the placeholder rule with the real stylesheet and
  renames the asset to a content hash.

`kirana()` returns two plugins, which Vite flattens, so it is still one entry in
`plugins`. The second, `kirana:late`, runs at the end of a build for a stylesheet
asset a framework adds after the first has filled the others (Qwik does).

`?url`, `?raw` and `?inline` behave the way they do for any other Vite asset.

## Diagnostics in the terminal

Errors fail the build; warnings print with their file, line and help text. Info
diagnostics are quiet unless you pass `reportInfo: true`, which is useful when you
want to see every runtime bridge in an application.

## Rolldown

Vite 8 is Rolldown-backed, and the plugin uses Rolldown's filters, so a
Rolldown-only setup works the same way.
