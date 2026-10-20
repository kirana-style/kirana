/**
 * `cssLayer(name, include)`: another package's stylesheets, wrapped in a cascade layer as Vite
 * loads them. CSS outside any layer beats every layered rule, whatever its specificity, so a theme
 * that ships unlayered CSS (VitePress's default theme, with its `* { padding: 0 }` reset) would win
 * over each style written with `css()`. Inside a layer that `kirana.config` orders before Kirana's
 * (`layers: { before: ["vitepress"] }`), it loses to them, as a reset should.
 *
 *   plugins: [kirana(), cssLayer("vitepress", "vitepress/dist/client/theme-default/")]
 *
 * It is the bundler-side form of `@import "…" layer(vendor)` (config/layers.md), for stylesheets a
 * package imports from JavaScript, where no `@import` line exists to edit.
 */
import { cleanId } from "@kirana-style/compiler/host"
import type { Plugin } from "vite"

const STYLESHEET = /\.css(?:[?#]|$)/

/**
 * A stylesheet's rules inside `@layer name { … }`. `@charset` and `@import` must come first in a
 * stylesheet, so they stay outside the block, each import taking the layer itself unless it names
 * one.
 */
export function wrapInLayer(css: string, name: string): string {
  const head: string[] = []
  const rules = css
    .replace(/^\s*@charset\s+[^;]+;/i, (charset) => {
      head.push(charset.trim())
      return ""
    })
    .replace(/^\s*@import\s+([^;]+);/gm, (_, target: string) => {
      head.push(
        /\blayer\b/.test(target)
          ? `@import ${target};`
          : `@import ${target} layer(${name});`
      )
      return ""
    })
  return `${head.map((line) => `${line}\n`).join("")}@layer ${name} {\n${rules.trim()}\n}\n`
}

/** Wraps every stylesheet whose path contains `include` (or matches it) in `@layer name`. */
export function cssLayer(name: string, include: string | RegExp): Plugin {
  const matches = (id: string) => {
    const file = cleanId(id).replaceAll("\\", "/")
    return typeof include === "string"
      ? file.includes(include)
      : include.test(file)
  }
  return {
    name: `kirana:css-layer:${name}`,
    enforce: "pre",
    transform: {
      filter: { id: STYLESHEET },
      handler(code, id) {
        if (!matches(id)) return null
        return { code: wrapInLayer(code, name), map: null }
      },
    },
  }
}
