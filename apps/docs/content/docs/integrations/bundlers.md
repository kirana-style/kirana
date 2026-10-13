---
title: Bundlers
description: Kirana on every bundler - Vite, Rolldown, webpack, Rspack, Rsbuild, Parcel, Bun, esbuild, PostCSS and Jest, each with its own guide and tested example.
section: integrations
order: 2
keywords:
  [
    bundlers,
    rolldown,
    webpack,
    rspack,
    rsbuild,
    parcel,
    bun,
    esbuild,
    postcss,
    jest,
    plugin,
  ]
---

# Bundlers

Every adapter does the same small job: it hands modules that carry styles to the
compiler, and puts the finished stylesheet where the bundler expects it. None of
them interprets a style, so the atoms, the class names and the stylesheet are
byte-for-byte the same whichever bundler built them.

<!-- ::guides group="bundlers" -->

## Development servers

<!-- consistency: subset -->

Every host updates the stylesheet while you work. Vite, webpack, Rspack, Rsbuild
and Next.js send it as a CSS hot update; Bun and esbuild as their reload. Each is
checked on every change: the dev server starts, a style is edited, and the page
must show it.

## Same styles on every host

Kirana's adapters only hand modules to one compiler and put its stylesheet where
the bundler expects it, so the same source gives the same CSS whichever bundler
builds it. CI checks exactly that: one React example, built with every bundler,
must produce the same set of classes as with Vite.
