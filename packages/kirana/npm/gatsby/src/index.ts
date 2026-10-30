/**
 * Kirana for Gatsby (D-071). Gatsby builds with webpack, in stages — the browser bundle, and the
 * server render that writes each page's HTML — so the plugin adds Kirana's webpack plugin to every
 * stage. The stages' compilers share one compiler session, as Next.js's server and client do, so a
 * class name is the same in the HTML and in the browser.
 *
 *   gatsby-config.js   plugins: ["@kirana-style/gatsby"]
 *   gatsby-browser.js  import "@kirana-style/core/stylesheet.css"
 */
import { KiranaPlugin } from "@kirana-style/webpack"
import type { KiranaWebpackOptions } from "@kirana-style/webpack"

/** The part of Gatsby's `onCreateWebpackConfig` arguments the plugin uses. */
export type CreateWebpackConfigArgs = {
  stage: string
  actions: { setWebpackConfig: (config: { plugins: unknown[] }) => void }
}

/** Gatsby passes a plugin's options with its own `plugins` list; the rest are Kirana's. */
export type KiranaGatsbyOptions = KiranaWebpackOptions & { plugins?: unknown }

export function onCreateWebpackConfig(
  { actions }: CreateWebpackConfigArgs,
  given: KiranaGatsbyOptions = {}
): void {
  const options = Object.fromEntries(
    Object.entries(given).filter(([key]) => key !== "plugins")
  ) as KiranaWebpackOptions
  actions.setWebpackConfig({ plugins: [new KiranaPlugin(options)] })
}
