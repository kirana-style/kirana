/**
 * The Jest host adapter (KRN-INT-003): a transformer that compiles a module's styles, then hands the
 * result to the transformer the project already uses (`babel-jest` unless configured), which strips
 * types and JSX as before. Tests see the class names the application ships; no stylesheet is
 * written, because Jest renders no CSS.
 *
 *   transform: { "\\.[jt]sx?$": ["@kirana-style/jest", { transformer: "babel-jest" }] }
 *
 * Jest's `process` is synchronous, so the Driver is opened with `Driver.createSync`. Jest caches a
 * module by its own source: after changing tokens another module reads, run Jest once with
 * `--no-cache`.
 */
import { createRequire } from "node:module"
import path from "node:path"

import type { DriverOptions } from "@kirana-style/compiler"
import { Driver, formatDiagnostic } from "@kirana-style/compiler"
import { shouldCompile } from "@kirana-style/compiler/host"
import type { KiranaConfig } from "@kirana-style/core/config"

export type KiranaJestOptions = {
  /** The project root: where `kirana.config.*` and `@kirana-style/core` are found. Default: the working directory. */
  root?: string
  /** Options that override `kirana.config.*`. */
  config?: KiranaConfig
  /** The transformer that runs after Kirana. Default: `babel-jest`. */
  transformer?: string
  /** Options for that transformer. */
  transformerConfig?: unknown
  /** Injected Driver options (tests). */
  driver?: Pick<DriverOptions, "native">
}

type Transformed = string | { code: string; map?: unknown }
type Transformer = {
  process: (source: string, file: string, options: unknown) => Transformed
}
type TransformerModule = Transformer & {
  createTransformer?: (config?: unknown) => Transformer
}

export function createTransformer(options: KiranaJestOptions = {}) {
  const root = options.root ?? process.cwd()
  let driver: Driver | undefined
  let next: Transformer | undefined
  const chained = () => {
    if (next) return next
    const loaded = createRequire(path.join(root, "package.json"))(
      options.transformer ?? "babel-jest"
    ) as TransformerModule | { default: TransformerModule }
    const module = "default" in loaded ? loaded.default : loaded
    next = module.createTransformer
      ? module.createTransformer(options.transformerConfig)
      : module
    return next
  }
  return {
    canInstrument: false,
    process(
      source: string,
      file: string,
      transformOptions: unknown
    ): Transformed {
      driver ??= Driver.createSync({
        root,
        config: options.config,
        ...options.driver,
      })
      let code = source
      if (shouldCompile(file, source, driver.libraries)) {
        const result = driver.transform(file, source, { map: false })
        for (const diagnostic of result.diagnostics) {
          const message = formatDiagnostic(diagnostic, source)
          if (diagnostic.severity === "error") throw new Error(message)
          if (diagnostic.severity === "warning") console.warn(message)
        }
        code = result.code ?? source
      }
      return chained().process(code, file, transformOptions)
    },
  }
}

export default { createTransformer }
