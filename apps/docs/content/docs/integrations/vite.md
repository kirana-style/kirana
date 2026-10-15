---
title: Vite
description: The @kirana-style/vite plugin: its options, the stylesheet entry, hot updates and the built asset.
section: bundlers
order: 2
keywords: [vite, rolldown, plugin, hmr, stylesheet, build]
---

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
})
```

Both are optional, and most projects pass nothing: the plugin finds
`kirana.config.*` in the Vite root on its own.

## Which modules it compiles

Script files only (TypeScript and JavaScript, with or without JSX, ES modules
included) outside `node_modules`, and only when the text contains `@kirana-style/`
or an `sx` attribute.
That prefilter is why adding Kirana to a large application does not slow the build
down in proportion to its size.

Markdown, HTML and other assets are never compiled, so `sx` written there does
nothing.

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
