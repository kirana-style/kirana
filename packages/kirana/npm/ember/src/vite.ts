/**
 * Kirana for Ember on Embroider and Vite (D-072). A `.gjs` or `.gts` file holds a `<template>`
 * Kirana's parser does not read, so its Vite plugin runs after Embroider's instead and compiles the
 * JavaScript Embroider emitted for each module, where `css()` calls and their imports are as written.
 * Its transform takes those modules too, which a Vite plugin's filter would otherwise skip, and
 * `@ember/`, `@glimmer/` and `@embroider/virtual/` — modules only Embroider resolves — are runtime values (`externals`).
 *
 *   plugins: [classicEmberSupport(), ember(), babel({ … }), kiranaEmber()]
 */
import kirana from "@kirana-style/vite"
import type { KiranaViteOptions } from "@kirana-style/vite"
import type { Plugin } from "vite"

export type { KiranaViteOptions as KiranaEmberOptions }

/** Ember's template-tag modules, as Vite names them. */
export const TEMPLATE_TAG = /\.g[jt]s(?:[?#]|$)/

/** What Embroider resolves and Node.js cannot: Ember's own modules. */
export const EMBER_EXTERNALS = ["@ember/", "@glimmer/", "@embroider/virtual/"]

export function kiranaEmber(options: KiranaViteOptions = {}): Plugin[] {
  // Inline options override `kirana.config` key by key, so a project's own `externals` go here.
  const externals = [...(options.config?.externals ?? []), ...EMBER_EXTERNALS]
  const [main, late] = kirana({
    ...options,
    config: { ...options.config, externals },
  })
  const transform = main.transform as {
    filter: { id: { include: RegExp; exclude: RegExp[] }; code: RegExp }
    handler: unknown
  }
  return [
    {
      ...main,
      enforce: "post",
      transform: {
        ...transform,
        filter: {
          ...transform.filter,
          id: {
            ...transform.filter.id,
            include: [transform.filter.id.include, TEMPLATE_TAG],
          },
        },
      } as Plugin["transform"],
    },
    late,
  ]
}

export default kiranaEmber
