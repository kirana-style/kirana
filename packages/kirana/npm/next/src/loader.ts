/**
 * The Turbopack loader (KRN-INT-010): compiles one module in a session of the loader process. The
 * stylesheet is not its business — `@kirana-style/postcss` compiles the project into it — so it only
 * rewrites styles into class names, which are the same in both sessions (D-037).
 *
 * Turbopack implements part of webpack's loader API; `addDependency` and `emitWarning` are used only
 * where they exist.
 */
import { Driver } from "@kirana-style/compiler"
import { createReporter, shouldCompile } from "@kirana-style/compiler/host"

export type LoaderContext = {
  resourcePath: string
  getOptions: () => { root: string }
  async: () => (error: Error | null, code?: string, map?: unknown) => void
  addDependency?: (file: string) => void
  emitWarning?: (warning: Error) => void
}

const drivers = new Map<string, Promise<Driver>>()

/** The session for a project root, opened once per loader process. */
export function driverFor(root: string): Promise<Driver> {
  let driver = drivers.get(root)
  if (!driver) {
    driver = Driver.create({ root })
    drivers.set(root, driver)
  }
  return driver
}

const reporter = createReporter()

export default function kiranaLoader(
  this: LoaderContext,
  source: string,
  map?: unknown
): void {
  const callback = this.async()
  const file = this.resourcePath
  driverFor(this.getOptions().root)
    .then((driver) => {
      if (!shouldCompile(file, source, driver.libraries)) {
        callback(null, source, map)
        return
      }
      const result = driver.transform(file, source)
      for (const dependency of result.dependencies)
        this.addDependency?.(dependency)
      reporter.module(
        {
          warn: (message) => this.emitWarning?.(new Error(message)),
          error: (message) => {
            throw new Error(message)
          },
        },
        file,
        source,
        result.diagnostics
      )
      if (result.code === undefined) callback(null, source, map)
      else callback(null, result.code, result.map && JSON.parse(result.map))
    })
    .catch((error: Error) => callback(error))
}
