/**
 * The Bun bundler host adapter (KRN-INT-001, KRN-INT-003): `onLoad` compiles modules and loads the
 * stylesheet entry as the placeholder rule, and `onEnd` replaces it in the CSS Bun wrote. It never
 * interprets styles (D-028). A `naming` pattern that hashes assets keeps the placeholder's hash, and
 * a build with `write: false` keeps the placeholder, since there is no file to finish.
 */
import { createHash } from "node:crypto"
import { existsSync, writeFileSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Driver } from "@kirana-style/compiler"
import type { DriverOptions } from "@kirana-style/compiler"
import {
  PLACEHOLDER,
  createReporter,
  fillStylesheet,
  shouldCompile,
  stylesheetPath,
} from "@kirana-style/compiler/host"
import type { KiranaConfig } from "@kirana-style/core/config"

export type KiranaBunOptions = {
  /** The project root: where `kirana.config.*` and `@kirana-style/core` are found. Default: the working directory. */
  root?: string
  /** Options that override `kirana.config.*`. */
  config?: KiranaConfig
  /** Report `info` diagnostics (such as `dynamic-bridged`) as warnings. */
  reportInfo?: boolean
  /** Injected Driver options (tests). */
  driver?: Pick<DriverOptions, "native" | "importModule">
}

type Loaded = { contents: string; loader: string } | undefined
/** The part of Bun's plugin builder the plugin uses. */
export type PluginBuilder = {
  /** `Bun.build` passes its options, `entrypoints` included; the dev server (`bun ./index.html`) does not. */
  config: { minify?: boolean | object; entrypoints?: unknown }
  onResolve: (
    options: { filter: RegExp },
    resolve: (args: { path: string }) => { path: string } | undefined
  ) => void
  onLoad: (
    options: { filter: RegExp },
    load: (args: { path: string }) => Loaded | Promise<Loaded>
  ) => void
  onEnd: (
    end: (result: { outputs: { path: string }[] }) => void | Promise<void>
  ) => void
}

const LOADERS: Record<string, string> = {
  tsx: "tsx",
  ts: "ts",
  mts: "ts",
  cts: "ts",
  jsx: "jsx",
}

export default function kirana(options: KiranaBunOptions = {}) {
  return {
    name: "kirana",
    setup(build: PluginBuilder) {
      const root = options.root ?? process.cwd()
      const stylesheetFile = stylesheetPath(root)
      let driver: Promise<Driver> | undefined
      const session = () =>
        (driver ??= Driver.create({
          root,
          config: options.config,
          ...options.driver,
        }))
      const reporter = createReporter(options)
      const context = {
        warn: (message: string) => console.warn(message),
        error: (message: string): never => {
          throw new Error(message)
        },
      }

      // The dev server: the stylesheet import resolves to a file this plugin rewrites whenever the
      // stylesheet changes, which Bun watches and hot-reloads (KRN-INT-009). A build instead gets
      // the placeholder and has it replaced in `onEnd`.
      const live = !("entrypoints" in build.config)
        ? join(
            tmpdir(),
            `kirana-bun-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.css`
          )
        : undefined
      // Modules compile in parallel, so stylesheet writes are queued: each takes the stylesheet as
      // it is when its turn comes, and the last one written is the newest.
      let writing = Promise.resolve()
      const refresh = () =>
        (writing = writing.then(async () => {
          if (live) await writeFile(live, (await session()).stylesheet(false))
        }))
      if (live) {
        writeFileSync(live, "")
        build.onResolve(
          { filter: /^@kirana-style\/core\/stylesheet\.css$/ },
          () => ({
            path: live,
          })
        )
      }

      build.onLoad({ filter: /stylesheet\.css$/ }, ({ path }) =>
        path === stylesheetFile
          ? { contents: PLACEHOLDER, loader: "css" }
          : undefined
      )

      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }) => {
        const compiler = await session()
        if (!compiler.compiles(path)) return undefined
        const code = await readFile(path, "utf8")
        if (!shouldCompile(path, code, compiler.libraries)) return undefined
        // Bun's loader takes the code alone: a map would be built and dropped. The engine compiles
        // off Bun's thread, so modules compile in parallel.
        const result = await compiler.transformAsync(path, code, { map: false })
        reporter.module(context, path, code, result.diagnostics)
        if (result.cssChanged) await refresh()
        if (result.code === undefined) return undefined
        return {
          contents: result.code,
          loader: LOADERS[path.slice(path.lastIndexOf(".") + 1)] ?? "js",
        }
      })

      build.onEnd(async ({ outputs }) => {
        const compiled = await session()
        reporter.project(context, compiled.root, compiled.diagnostics())
        const css = compiled.stylesheet(Boolean(build.config.minify))
        for (const { path } of outputs) {
          if (!path.endsWith(".css") || !existsSync(path)) continue
          const source = fillStylesheet(await readFile(path, "utf8"), css)
          if (source !== undefined) await writeFile(path, source)
        }
      })
    },
  }
}
