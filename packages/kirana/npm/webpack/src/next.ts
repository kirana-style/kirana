/**
 * Next.js with webpack (`next build --webpack`, KRN-INT-003): `withKirana` adds the plugin to every
 * compiler Next creates — server, client and edge — at the project directory, and keeps any
 * `webpack` function the configuration already has. For Turbopack, `@kirana-style/next` configures both.
 */
import { KiranaPlugin } from "./index.ts"
import type { KiranaWebpackOptions } from "./session.ts"

type WebpackConfig = { plugins?: unknown[] }
type NextContext = { dir: string }
type NextConfig = {
  webpack?: (config: WebpackConfig, context: NextContext) => WebpackConfig
  [key: string]: unknown
}

export function withKirana<Config extends NextConfig>(
  nextConfig: Config = {} as Config,
  options: KiranaWebpackOptions = {}
): Omit<Config, "webpack"> & Required<Pick<NextConfig, "webpack">> {
  return {
    ...nextConfig,
    webpack(config: WebpackConfig, context: NextContext) {
      ;(config.plugins ??= []).push(
        new KiranaPlugin({ root: context.dir, ...options })
      )
      return nextConfig.webpack ? nextConfig.webpack(config, context) : config
    },
  }
}
