/**
 * The loader half of the webpack and Rspack adapter (KRN-INT-001): it compiles one module, or
 * answers the stylesheet entry with the placeholder rule the plugin later replaces. The plugin
 * registers it as a `pre` loader, so it sees the source before any other loader strips types or JSX.
 */
import { PLACEHOLDER, shouldCompile } from "@kirana-style/compiler/host"

import { sessions } from "./session.ts"

/** The part of webpack's and Rspack's loader context the loader uses. */
export type LoaderContext = {
  resourcePath: string
  resourceQuery: string
  getOptions: () => { session: string }
  async: () => (error: Error | null, code?: string, map?: unknown) => void
  addDependency: (file: string) => void
  emitWarning: (warning: Error) => void
}

export default function kiranaLoader(
  this: LoaderContext,
  source: string,
  map?: unknown
): void {
  const callback = this.async()
  const session = sessions.get(this.getOptions().session)
  if (!session) {
    callback(
      new Error(
        "@kirana-style/webpack/loader runs only through the Kirana plugin: add `new KiranaPlugin()` to `plugins`"
      )
    )
    return
  }
  const file = this.resourcePath
  session
    .driver()
    .then((driver) => {
      // In a build the plugin writes the finished stylesheet into the emitted asset; while watching,
      // the entry is the live stylesheet (see index.ts).
      if (file === session.stylesheetFile) {
        if (session.live) {
          this.addDependency(session.live)
          callback(null, driver.stylesheet(false))
        } else callback(null, PLACEHOLDER)
        return
      }
      if (!shouldCompile(file + this.resourceQuery, source, driver.libraries)) {
        callback(null, source, map)
        return
      }
      const result = driver.transform(file, source)
      session.compiled.add(file)
      for (const dependency of result.dependencies)
        this.addDependency(dependency)
      session.reporter.module(
        {
          warn: (message) => this.emitWarning(new Error(message)),
          error: (message) => {
            throw new Error(message)
          },
        },
        file,
        source,
        result.diagnostics
      )
      if (result.code === undefined) callback(null, source, map)
      // An object, as loaders pass maps to each other: Next.js's SWC loader encodes a string again.
      else callback(null, result.code, result.map && JSON.parse(result.map))
    })
    .catch((error: Error) => callback(error))
}
