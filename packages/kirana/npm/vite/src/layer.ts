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
 * A stylesheet's rules inside `@layer name { … }`. `@charset` and `@import` are valid only before
 * every other rule, so the leading ones (and the comments among them) stay outside the block, each
 * import taking the layer itself unless it names one. Read statement by statement, in one pass:
 * no pattern here can backtrack over a long run of spaces in a dependency's CSS.
 */
export function wrapInLayer(css: string, name: string): string {
  const head: string[] = []
  let at = 0
  for (;;) {
    while (at < css.length && /\s/.test(css[at]!)) at++
    if (css.startsWith("/*", at)) {
      const close = css.indexOf("*/", at + 2)
      if (close < 0) break
      head.push(css.slice(at, close + 2))
      at = close + 2
      continue
    }
    const keyword = ["@charset", "@import"].find(
      (word) => css.slice(at, at + word.length).toLowerCase() === word
    )
    const end = keyword ? css.indexOf(";", at) : -1
    if (end < 0) break
    const statement = css.slice(at, end + 1)
    const target = statement.slice(keyword!.length, -1).trim()
    head.push(
      keyword === "@charset" || /\blayer\b/.test(target)
        ? statement
        : `@import ${target} layer(${name});`
    )
    at = end + 1
  }
  return `${head.map((line) => `${line}\n`).join("")}@layer ${name} {\n${css.slice(at).trim()}\n}\n`
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
