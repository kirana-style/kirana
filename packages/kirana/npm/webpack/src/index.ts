/**
 * The webpack 5 and Rspack host adapter (KRN-INT-001, KRN-INT-003): a `pre` loader compiles modules
 * and answers the stylesheet entry, ordinary CSS to the host, with the placeholder rule. The plugin
 * fills the emitted asset at `processAssets`' optimize stage: after every module, before the CSS
 * minimizer and `realContentHash`. Not `rebuildModule` at `finishModules`: Rspack 2 panics ("should
 * have event sender") rebuilding a module under Rsbuild's CSS extraction. It never interprets styles
 * (D-028).
 */
import {
  fillStylesheet,
  shouldCompile,
  stylesheetPath,
} from "@kirana-style/compiler/host"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createSession, sessions } from "./session.ts"
import type { KiranaWebpackOptions } from "./session.ts"

export type { KiranaWebpackOptions } from "./session.ts"

/** The loader, next to this file with the same extension (TypeScript source in the workspace, JavaScript when packed). */
const LOADER = fileURLToPath(
  new URL(
    `./loader${import.meta.url.slice(import.meta.url.lastIndexOf("."))}`,
    import.meta.url
  )
)

type Asset = { name: string; source: { source: () => string | Buffer } }
type Compilation = {
  warnings: Error[]
  errors: Error[]
  getAssets: () => readonly Asset[]
  updateAsset: (name: string, source: unknown) => void
  hooks: {
    finishModules: {
      tapPromise: (
        name: string,
        hook: (modules: Iterable<unknown>) => Promise<void>
      ) => void
    }
    processAssets: {
      tapPromise: (
        options: { name: string; stage: number },
        hook: () => Promise<void>
      ) => void
    }
  }
}
/** The part of webpack's and Rspack's compiler the plugin uses. */
export type Compiler = {
  context: string
  options: {
    mode?: string
    module: { rules: unknown[] }
  }
  webpack: {
    WebpackError: new (message: string) => Error
    Compilation: { PROCESS_ASSETS_STAGE_OPTIMIZE: number }
    sources: { RawSource: new (source: string) => unknown }
  }
  hooks: {
    thisCompilation: {
      tap: (name: string, hook: (compilation: Compilation) => void) => void
    }
    invalid: {
      tap: (name: string, hook: (file: string | null) => void) => void
    }
    watchRun: { tapPromise: (name: string, hook: () => Promise<void>) => void }
    done: { tapPromise: (name: string, hook: () => Promise<void>) => void }
  }
}

const NAME = "kirana"
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/

export class KiranaPlugin {
  readonly options: KiranaWebpackOptions

  constructor(options: KiranaWebpackOptions = {}) {
    this.options = options
  }

  apply(compiler: Compiler): void {
    const root = this.options.root ?? compiler.context
    const stylesheetFile = stylesheetPath(root)
    const id = createSession(
      this.options,
      root,
      stylesheetFile,
      compiler.options.mode !== "development"
    )
    const session = sessions.get(id)!
    const loader = {
      loader: this.options.loader ?? LOADER,
      options: { session: id },
    }
    compiler.options.module.rules.unshift(
      {
        enforce: "pre",
        test: SCRIPT_FILE,
        // Installed packages pass through the loader untouched unless they are in `libraries`.
        use: [loader],
      },
      {
        enforce: "pre",
        test: (file: string) => file === stylesheetFile,
        use: [loader],
      }
    )

    // A watch rebuild: modules that read the changed file's tokens or relations compile again.
    compiler.hooks.invalid.tap(NAME, (file) => {
      if (file) void session.driver().then((driver) => driver.invalidate(file))
    })

    // Watching: the stylesheet entry follows a file the plugin rewrites whenever the stylesheet
    // changes, outside `node_modules`, which bundlers treat as immutable and do not watch.
    compiler.hooks.watchRun.tapPromise(NAME, async () => {
      if (session.live) return
      session.live = path.join(
        tmpdir(),
        `kirana-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.css`
      )
      await writeFile(session.live, "")
    })
    compiler.hooks.done.tapPromise(NAME, async () => {
      if (!session.live) return
      const css = (await session.driver()).stylesheet(false)
      if ((await readFile(session.live, "utf8")) !== css)
        await writeFile(session.live, css)
    })

    compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
      const { Compilation, sources, WebpackError } = compiler.webpack
      compilation.hooks.finishModules.tapPromise(NAME, async (modules) => {
        const driver = await session.driver()
        // Modules a persistent cache restored never reached the loader: compile them from disk, so
        // their atoms are in the stylesheet, all at once off webpack's thread. Their cached code
        // already names the same classes.
        const restored = new Set<string>()
        for (const module of modules) {
          // A module without a file (webpack's runtime) has no `resource`, and is no script.
          const file = String((module as { resource?: string }).resource).split(
            "?"
          )[0]!
          if (SCRIPT_FILE.test(file) && !session.compiled.has(file))
            restored.add(file)
        }
        await Promise.all(
          [...restored].map(async (file) => {
            const source = await readFile(file, "utf8")
            if (!shouldCompile(file, source, driver.libraries)) return
            // Only the stylesheet needs these: the cached code is what the bundle keeps.
            await driver.transformAsync(file, source, { map: false })
            session.compiled.add(file)
          })
        )
        try {
          session.reporter.project(
            {
              warn: (message) =>
                compilation.warnings.push(new WebpackError(message)),
              error: (message) => {
                throw new WebpackError(message)
              },
            },
            driver.root,
            driver.diagnostics()
          )
        } catch (error) {
          compilation.errors.push(error as Error)
        }
      })
      compilation.hooks.processAssets.tapPromise(
        { name: NAME, stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE },
        async () => {
          const css = (await session.driver()).stylesheet(session.minify)
          for (const asset of compilation.getAssets()) {
            if (!asset.name.endsWith(".css")) continue
            const source = fillStylesheet(String(asset.source.source()), css)
            if (source !== undefined)
              compilation.updateAsset(asset.name, new sources.RawSource(source))
          }
        }
      )
    })
  }
}

export default KiranaPlugin
