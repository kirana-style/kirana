---
title: Cloudflare Workers
description: Run a Kirana app on Cloudflare Workers with Cloudflare's Vite plugin, in development inside workerd and in production.
section: building
order: 5
keywords:
  [
    cloudflare,
    workers,
    workerd,
    wrangler,
    "@cloudflare/vite-plugin",
    tanstack start,
    ssr,
  ]
---

# Cloudflare Workers

Cloudflare's Vite plugin runs an app's server half inside workerd, the runtime
Workers use, during `vite dev` and `vite build` alike, so a Node-only API fails on
your machine rather than after deploying. Kirana's
`examples/tanstack-start-cloudflare` is checked on every change this way: built,
then served from a cold cache with its first request rendered in workerd.

## The plugins, in order

```ts file="vite.config.ts"
import { cloudflare } from "@cloudflare/vite-plugin"
import kirana from "@kirana-style/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    kirana(),
    tanstackStart(),
    viteReact(),
  ],
})
```

Cloudflare's plugin comes first, so it owns the server environment before the
framework configures it. Kirana comes before the framework plugins, as with any
Vite app, so modules reach them compiled.

The Worker's entry is the framework's server entry:

```jsonc file="wrangler.jsonc"
{
  "name": "my-app",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
}
```

## Development and preview

`vite dev` renders each request in workerd. `vite preview` serves the production
build in workerd too, the way Cloudflare will, and `wrangler deploy` ships it:

```bash
vite build && vite preview
```

## Workers and pre-bundling

Vite pre-bundles the Worker's dependencies apart from the browser's. Kirana's Vite
plugin names its runtime for pre-bundling and keeps its presets compiled in every
environment, so nothing needs configuring.

Kirana 0.3.1 did that for the browser only: the first request in development
discovered Kirana's runtime late, re-optimised and loaded React twice, and a
pre-bundled preset threw `defineTokens() ran without being compiled`. On 0.3.1, name
the runtime and keep the preset out of workerd's pre-bundling:

```ts file="vite.config.ts"
export default defineConfig({
  optimizeDeps: { include: ["@kirana-style/core/internal"] },
  environments: {
    ssr: {
      optimizeDeps: {
        include: ["@kirana-style/core/internal"],
        exclude: ["@kirana-style/preset-scales"],
      },
    },
  },
  // the plugins, as above
})
```

Remove it when you upgrade past 0.3.1.

## A stylesheet of your own

A stylesheet you write goes through Vite's CSS minifier, which lowers
`light-dark()` unless `build.cssTarget` is set to Kirana's floor:
[the Vite guide](/docs/integrations/vite#a-stylesheet-of-your-own) has the setting.
