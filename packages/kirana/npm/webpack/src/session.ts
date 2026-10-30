/**
 * What the plugin and the loader share: one Driver per compiler, found by an id the plugin puts in
 * the loader's options. An id rather than the object, because Rspack hands loader options across its
 * JavaScript–Rust boundary as data.
 */
import { Driver } from "@kirana-style/compiler"
import type { DriverOptions } from "@kirana-style/compiler"
import { createReporter } from "@kirana-style/compiler/host"
import type { KiranaConfig } from "@kirana-style/core/config"

export type KiranaWebpackOptions = {
  /** The project root: where `kirana.config.*` and `@kirana-style/core` are found. Default: the compiler's context. */
  root?: string
  /** Options that override `kirana.config.*`. */
  config?: KiranaConfig
  /** Report `info` diagnostics (such as `dynamic-bridged`) as warnings. */
  reportInfo?: boolean
  /** Injected Driver options (tests). */
  driver?: Pick<DriverOptions, "native" | "importModule">
  /** The loader's path, in place of this package's (tests: one instance of the loader to measure). */
  loader?: string
}

export type Session = {
  root: string
  /** `@kirana-style/core/stylesheet.css` as the compiler resolves it. */
  stylesheetFile: string
  minify: boolean
  driver: () => Promise<Driver>
  reporter: ReturnType<typeof createReporter>
  /**
   * The scripts this process's loader compiled. A persistent cache (`cache: { type: "filesystem" }`,
   * which Meteor turns on) hands back a module without running loaders, so the plugin compiles the
   * rest from disk before it writes the stylesheet.
   */
  compiled: Set<string>
  /**
   * Set while the compiler watches (a dev server, `--watch`): the stylesheet entry then holds the
   * live stylesheet and depends on this file, which the plugin rewrites when the stylesheet changes
   * so the bundler rebuilds the entry and sends its own CSS hot update (KRN-INT-009).
   */
  live?: string
}

/**
 * Registries live on `globalThis` under registered symbols, because the loader is loaded by the
 * bundler's own module loader and may be a second instance of this module (a test runner's, or a
 * duplicated install); every instance must find the same entries.
 */
export const sessions: Map<string, Session> = registry("sessions")

/**
 * One Driver and one reporter per project (root and configuration), shared by every compiler that
 * builds it. Next.js compiles server components only in its server compiler but emits the stylesheet
 * from the client one, which it builds last, so a shared Driver gives that stylesheet every atom.
 * Sharing also reports a module's warnings once, not once per compiler.
 */
const projects: Map<
  string,
  Pick<Session, "driver" | "reporter" | "compiled">
> = registry("projects")

function registry<Value>(name: string): Map<string, Value> {
  return ((globalThis as { [key: symbol]: Map<string, Value> })[
    Symbol.for(`kirana.webpack.${name}`)
  ] ??= new Map())
}

export function createSession(
  options: KiranaWebpackOptions,
  root: string,
  stylesheetFile: string,
  minify: boolean
): string {
  const id = `kirana-${sessions.size}`
  const key = JSON.stringify([
    root,
    options.config ?? null,
    options.reportInfo ?? false,
  ])
  // Injected engines (tests) are never shared, in either direction.
  let project = options.driver ? undefined : projects.get(key)
  if (!project) {
    let driver: Promise<Driver> | undefined
    project = {
      driver: () =>
        (driver ??= Driver.create({
          root,
          config: options.config,
          ...options.driver,
        })),
      reporter: createReporter(options),
      compiled: new Set(),
    }
    if (!options.driver) projects.set(key, project)
  }
  sessions.set(id, { root, stylesheetFile, minify, ...project })
  return id
}
