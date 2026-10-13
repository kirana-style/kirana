/**
 * The Rspack and Rsbuild host adapter (KRN-INT-003). Rspack implements webpack's plugin and loader
 * API, so the plugin is `@kirana-style/webpack`'s, unchanged; this package names it for Rspack users and
 * adds the Rsbuild plugin, which puts it in the Rspack configuration Rsbuild generates.
 */
import { KiranaPlugin } from "@kirana-style/webpack"
import type { KiranaWebpackOptions } from "@kirana-style/webpack"

export { KiranaPlugin, type KiranaWebpackOptions as KiranaRspackOptions }

/** The part of Rsbuild's plugin API the plugin uses. */
export type RsbuildPluginAPI = {
  context: { rootPath: string }
  modifyRspackConfig: (
    modify: (config: { plugins?: unknown[] }) => void
  ) => void
}

/** `plugins: [pluginReact(), pluginKirana()]` in `rsbuild.config.ts`. */
export function pluginKirana(options: KiranaWebpackOptions = {}) {
  return {
    name: "kirana",
    setup(api: RsbuildPluginAPI) {
      api.modifyRspackConfig((config) => {
        ;(config.plugins ??= []).push(
          new KiranaPlugin({ root: api.context.rootPath, ...options })
        )
      })
    },
  }
}

export default KiranaPlugin
