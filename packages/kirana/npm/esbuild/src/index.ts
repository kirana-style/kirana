/**
 * The esbuild host adapter (KRN-INT-001, KRN-INT-003): `onLoad` compiles modules, and `onEnd` writes
 * the finished stylesheet into the CSS esbuild bundled. It never interprets styles (D-028).
 *
 * The stylesheet entry loads as the placeholder rule, which esbuild bundles like any CSS import
 * (`main.css` beside `main.js`); once every module has loaded, the plugin replaces it — in the written
 * file, or in `outputFiles` when esbuild keeps them in memory (`write: false`). Watch and serve reload
 * the entry itself from a file the plugin keeps current, so what `serve` sends follows every edit. A
 * `naming` pattern that hashes CSS keeps the placeholder's hash.
 */
import { createHash } from "node:crypto"
import { existsSync, writeFileSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

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
import type { Loader, OutputFile as EsbuildOutputFile, Plugin } from "esbuild"

export type KiranaEsbuildOptions = {
  /** The project root: where `kirana.config.*` and `@kirana-style/core` are found. Default: the working directory. */
  root?: string
  /** Options that override `kirana.config.*`. */
  config?: KiranaConfig
  /** Report `info` diagnostics (such as `dynamic-bridged`) as warnings. */
  reportInfo?: boolean
  /** Injected Driver options (tests). */
  driver?: Pick<DriverOptions, "native" | "importModule">
}

const LOADERS: Record<string, Loader> = {
  tsx: "tsx",
  ts: "ts",
  mts: "ts",
  cts: "ts",
  jsx: "jsx",
}

/** An output file with new text, in the shape esbuild gives them. */
function outputFile(file: EsbuildOutputFile, text: string): EsbuildOutputFile {
  return { ...file, contents: new TextEncoder().encode(text), text }
}

export default function kirana(options: KiranaEsbuildOptions = {}): Plugin {
  return {
    name: "kirana",
    setup(build) {
      const root = options.root ?? process.cwd()
      const stylesheetFile = stylesheetPath(root)
      // The written outputs are found through the metafile.
      build.initialOptions.metafile = true
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

      // Watch and serve: the entry follows a file `onEnd` writes whenever the stylesheet changes, so a
      // rebuild reloads it with the live stylesheet — which is what `serve` sends, from its own
      // copy of the outputs. The first load, and every load of a one-shot build, is the placeholder.
      const live = path.join(
        tmpdir(),
        `kirana-esbuild-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.css`
      )
      let written: string | undefined
      writeFileSync(live, "")
      build.onLoad({ filter: /stylesheet\.css$/ }, async ({ path: file }) =>
        file === stylesheetFile
          ? {
              contents:
                written === undefined
                  ? PLACEHOLDER
                  : (await session()).stylesheet(
                      Boolean(build.initialOptions.minify)
                    ),
              loader: "css" as const,
              watchFiles: [live],
            }
          : undefined
      )

      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path: file }) => {
        const compiler = await session()
        if (!compiler.compiles(file)) return undefined
        const code = await readFile(file, "utf8")
        if (!shouldCompile(file, code, compiler.libraries)) return undefined
        // esbuild takes the code alone: a map would be built and dropped.
        const result = compiler.transform(file, code, { map: false })
        reporter.module(context, file, code, result.diagnostics)
        if (result.code === undefined) return undefined
        return {
          contents: result.code,
          loader: LOADERS[file.slice(file.lastIndexOf(".") + 1)] ?? "js",
        }
      })

      build.onEnd(async (result) => {
        const compiler = await session()
        reporter.project(context, root, compiler.diagnostics())
        const css = compiler.stylesheet(Boolean(build.initialOptions.minify))
        if (css !== written) {
          written = css
          await writeFile(live, css)
        }
        if (result.outputFiles) {
          result.outputFiles.forEach((file, index) => {
            const source = file.path.endsWith(".css")
              ? fillStylesheet(file.text, css)
              : undefined
            if (source !== undefined)
              result.outputFiles![index] = outputFile(file, source)
          })
          return
        }
        const base = build.initialOptions.absWorkingDir ?? process.cwd()
        for (const output of Object.keys(result.metafile!.outputs)) {
          const file = path.resolve(base, output)
          if (!file.endsWith(".css") || !existsSync(file)) continue
          const source = fillStylesheet(await readFile(file, "utf8"), css)
          if (source !== undefined) await writeFile(file, source)
        }
      })
    },
  }
}
