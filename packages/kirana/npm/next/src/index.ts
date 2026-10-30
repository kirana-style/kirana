/**
 * Kirana for Next.js (KRN-INT-003, KRN-INT-010): one `withKirana` for both of Next's bundlers.
 * Turbopack runs loaders, not plugins, so a `turbopack.rules` entry runs `@kirana-style/next/loader`
 * on the project's scripts whose content can hold styles, and `@kirana-style/postcss` writes the
 * stylesheet at `@kirana;`. webpack (`next build --webpack`) gets `@kirana-style/webpack/next`.
 */
import { fileURLToPath } from "node:url"

import { STYLE_BEARING } from "@kirana-style/compiler/host"
import { withKirana as withWebpack } from "@kirana-style/webpack/next"
import type { KiranaWebpackOptions } from "@kirana-style/webpack"

/** The loader, next to this file with the same extension (TypeScript in the workspace, JavaScript when packed). */
export const LOADER = fileURLToPath(
  new URL(
    `./loader${import.meta.url.slice(import.meta.url.lastIndexOf("."))}`,
    import.meta.url
  )
)

/** The script extensions Turbopack hands to the loader. */
export const SCRIPTS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"]

export type KiranaNextOptions = KiranaWebpackOptions & {
  /** The project root; defaults to the working directory, which is the project's for `next`. */
  root?: string
}

type RuleItem =
  | string
  | { loader: string; options?: object }
  | { [key: string]: unknown }
type NextConfig = {
  turbopack?: {
    rules?: Record<string, RuleItem | RuleItem[]>
    [key: string]: unknown
  }
  webpack?: (
    config: { plugins?: unknown[] },
    context: { dir: string }
  ) => { plugins?: unknown[] }
  [key: string]: unknown
}

/** The rule that runs the loader: on the project's own scripts that can hold styles. */
export function rule(root: string) {
  return {
    condition: { all: [{ not: "foreign" }, { content: STYLE_BEARING }] },
    loaders: [{ loader: LOADER, options: { root } }],
  }
}

export function withKirana<Config extends NextConfig>(
  nextConfig: Config = {} as Config,
  options: KiranaNextOptions = {}
) {
  const root = options.root ?? process.cwd()
  const rules: Record<string, RuleItem | RuleItem[]> = {
    ...nextConfig.turbopack?.rules,
  }
  for (const extension of SCRIPTS) {
    const glob = `*.${extension}`
    const existing = rules[glob]
    // A project's own rule for the same files keeps running; Kirana's is added after it.
    rules[glob] =
      existing === undefined
        ? rule(root)
        : [...(Array.isArray(existing) ? existing : [existing]), rule(root)]
  }
  return {
    ...withWebpack(nextConfig, options),
    turbopack: { ...nextConfig.turbopack, rules },
  }
}
