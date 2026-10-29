import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { rspack } from "@rspack/core"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import webpack from "webpack"
import { Driver } from "@kirana-style/compiler"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"

import { PLACEHOLDER } from "@kirana-style/compiler/host"

import { KiranaPlugin } from "../src/index.ts"
import type { Compiler } from "../src/index.ts"
import kiranaLoader from "../src/loader.ts"
import type { LoaderContext } from "../src/loader.ts"
import { createSession, sessions } from "../src/session.ts"

const require = createRequire(import.meta.url)
// The bundlers load `loader-shim.mjs`, which calls this module's instance of the loader: one instance,
// so its coverage is measured once rather than split across two copies.
;(globalThis as { [key: symbol]: unknown })[
  Symbol.for("kirana.webpack.test-loader")
] = kiranaLoader
const shim = path.join(import.meta.dirname, "loader-shim.mjs")
const created: string[] = []
function app(): string {
  const directory = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  cpSync(path.join(import.meta.dirname, "app"), directory, { recursive: true })
  created.push(directory)
  return directory
}
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

type Options = {
  bundler?: "webpack" | "rspack"
  css?: "native" | "extract"
  mode?: "production" | "development"
  plugin?: ConstructorParameters<typeof KiranaPlugin>[0]
  /** A persistent cache, which restores modules without running loaders. */
  cache?: boolean
}

/** Builds the app and returns its stylesheet, its JavaScript, and what the compiler reported. */
async function bundle(root: string, options: Options = {}) {
  const { bundler = "webpack", css = "native", mode = "production" } = options
  const out = path.join(root, "dist")
  const extract = css === "extract"
  const config = {
    mode,
    context: root,
    ...(options.cache
      ? {
          cache: {
            type: "filesystem",
            cacheDirectory: path.join(root, ".cache"),
          },
        }
      : {}),
    entry: "./src/main.js",
    devtool: false as const,
    output: {
      path: out,
      filename: "[name].[contenthash].js",
      cssFilename: "[name].[contenthash].css",
    },
    ...(bundler === "webpack" && !extract
      ? { experiments: { css: true } }
      : {}),
    module: {
      rules: extract
        ? [
            {
              test: /\.css$/,
              use: [MiniCssExtractPlugin.loader, require.resolve("css-loader")],
            },
          ]
        : bundler === "rspack"
          ? [{ test: /\.css$/, type: "css" }]
          : [],
    },
    plugins: [
      new KiranaPlugin({ loader: shim, ...options.plugin }),
      ...(extract
        ? [new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" })]
        : []),
    ],
  }
  const stats = await new Promise<{
    hasErrors: () => boolean
    toJson: (options: object) => {
      errors?: { message: string }[]
      warnings?: { message: string }[]
    }
  }>((resolve, reject) => {
    const callback = (error: Error | null, result: unknown) =>
      error ? reject(error) : resolve(result as never)
    if (bundler === "rspack") rspack(config as never, callback as never)
    else webpack(config as never, callback as never)
  })
  const json = stats.toJson({ errors: true, warnings: true })
  // A build with errors emits nothing.
  const files = existsSync(out) ? readdirSync(out) : []
  const read = (suffix: string) =>
    files
      .filter((file) => file.endsWith(suffix))
      .map((file) => readFileSync(path.join(out, file), "utf8"))
      .join("\n")
  return {
    files,
    css: read(".css"),
    js: read(".js"),
    errors: (json.errors ?? []).map((error) => error.message).join("\n"),
    warnings: (json.warnings ?? [])
      .map((warning) => warning.message)
      .join("\n"),
  }
}

/** Every module compiles off the host's thread (`transformAsync`) and none on it (`transform`). */
function offThread() {
  const sync = vi.spyOn(Driver.prototype, "transform")
  const async = vi.spyOn(Driver.prototype, "transformAsync")
  return () => {
    expect(async).toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
    sync.mockRestore()
    async.mockRestore()
  }
}

describe("KRN-INT-003 webpack and Rspack", () => {
  it("webpack with native CSS: every atom, including a module built after the stylesheet", async () => {
    const { css, js, files, errors } = await bundle(app())
    expect(errors).toBe("")
    expect(css).toContain("@layer kirana")
    expect(css).toContain("display:grid")
    expect(css).toContain("outline-offset:3px")
    expect(css).not.toContain("kirana-placeholder")
    expect(js).toContain("k5O_")
    // realContentHash named the file by the finished stylesheet, not by the placeholder: other
    // styles, another name.
    const other = app()
    writeFileSync(
      path.join(other, "src/later.js"),
      'import { css } from "@kirana-style/core"\nexport const later = css({ outlineOffset: "4px" })\n'
    )
    const name = (list: string[]) => list.find((file) => file.endsWith(".css"))
    expect(name((await bundle(other)).files)).not.toBe(name(files))
  })

  it("compiles modules a persistent cache restored, which skip the loader", async () => {
    const root = app()
    // The loader and the restored modules alike compile off webpack's thread.
    const compiled = offThread()
    const first = await bundle(root, { cache: true })
    expect(first.css).toContain("display:grid")
    // Another process, as the next build is: a session that has compiled nothing yet.
    const fresh = { driver: { importModule: (url: string) => import(url) } }
    const second = await bundle(root, { cache: true, plugin: fresh })
    expect(second.errors).toBe("")
    expect(second.css).toContain("display:grid")
    expect(second.css).toBe(first.css)
    compiled()
  })

  it("webpack with css-loader and mini-css-extract-plugin, as Next.js builds", async () => {
    const { css, errors } = await bundle(app(), { css: "extract" })
    expect(errors).toBe("")
    expect(css).toContain("outline-offset:3px")
  })

  it("Rspack with native CSS", async () => {
    const { css, js, errors } = await bundle(app(), { bundler: "rspack" })
    expect(errors).toBe("")
    expect(css).toContain("outline-offset:3px")
    expect(js).toContain("k5O_")
  })

  it("development mode writes the stylesheet unminified", async () => {
    const { css } = await bundle(app(), { mode: "development" })
    expect(css).toContain("display: grid;")
  })

  it("fails on error diagnostics and warns on the rest", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/later.js"),
      'import { css } from "@kirana-style/core"\nexport const later = css({ colour: "red" })\n'
    )
    expect((await bundle(root)).errors).toContain("unknown-property")

    const info = app()
    writeFileSync(
      path.join(info, "src/later.js"),
      'import { css } from "@kirana-style/core"\nexport const later = css({ color: { "[data-a]": "red", "[data-b]": "blue" } })\n'
    )
    const { warnings } = await bundle(info, {
      plugin: { reportInfo: true, root: info },
    })
    expect(warnings).toContain("ambiguous-precedence")
  })

  it("reports project warnings once every module is built", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/later.js"),
      'import { css, cx, relation } from "@kirana-style/core"\nconst field = relation("field")\nexport const later = cx(field.anchor, css({ outlineOffset: "3px" }))\n'
    )
    expect((await bundle(root)).warnings).toContain("relation-unused")
  })

  it("reports project diagnostics once every module is built", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/later.js"),
      'import { css, relation } from "@kirana-style/core"\nconst field = relation("field")\nexport const later = css({ opacity: { [field.within()]: 0.5 } })\n'
    )
    expect((await bundle(root)).errors).toContain("relation-without-anchor")
  })
})

describe("the loader and plugin contract", () => {
  it("refuses to run without the plugin", async () => {
    const error = await new Promise<Error | null>((resolve) =>
      kiranaLoader.call(
        {
          getOptions: () => ({ session: "missing" }),
          async: () => resolve,
        } as unknown as LoaderContext,
        ""
      )
    )
    expect(error?.message).toContain("new KiranaPlugin()")
  })

  it("answers every kind of module", async () => {
    const root = app()
    const stylesheet = path.join(root, "kirana.css")
    const id = createSession({}, root, stylesheet, true)
    const load = (resourcePath: string, source: string) =>
      new Promise<{ error: Error | null; code?: string; map?: unknown }>(
        (resolve) =>
          kiranaLoader.call(
            {
              resourcePath,
              resourceQuery: "",
              getOptions: () => ({ session: id }),
              async:
                () => (error: Error | null, code?: string, map?: unknown) =>
                  resolve({ error, code, map }),
              addDependency: () => {},
              emitWarning: () => {},
            },
            source,
            "input map"
          )
      )
    const main = path.join(root, "src/later.js")
    const compiled = await load(main, readFileSync(main, "utf8"))
    expect(compiled.code).toContain("k")
    expect(compiled.map).toMatchObject({ version: 3 })
    expect((await load(stylesheet, "")).code).toBe(PLACEHOLDER)
    expect(await load(path.join(root, "src/a.css"), "a{}")).toEqual({
      error: null,
      code: "a{}",
      map: "input map",
    })
    const comment = "// @kirana-style/ in a comment\nexport const x = 1\n"
    expect((await load(path.join(root, "src/plain.js"), comment)).code).toBe(
      comment
    )
    const failed = await load(
      path.join(root, "src/bad.js"),
      'import { css } from "@kirana-style/core"\nexport const bad = css({ colour: "red" })\n'
    )
    expect(failed.error?.message).toContain("unknown-property")
  })

  it("shares one Driver per project across compilers, never an injected one", async () => {
    const root = app()
    const shared = (options: object) =>
      sessions.get(createSession(options, root, "", true))!.driver
    const server = shared({})
    expect(shared({})).toBe(server)
    expect(shared({ config: { names: { prefix: "ds" } } })).not.toBe(server)
    expect(shared({ reportInfo: true })).not.toBe(server)
    const native = { Compiler: class {} } as never
    const injected = shared({ driver: { native } })
    expect(injected).not.toBe(server)
    expect(shared({ driver: { native } })).not.toBe(injected)
  })

  it("while watching, answers the stylesheet live and rewrites the file it follows", async () => {
    const hooks: Record<string, () => Promise<void>> = {}
    const tap = (name: string) => ({
      tap: () => {},
      tapPromise: (_: string, hook: () => Promise<void>) =>
        (hooks[name] = hook),
    })
    const root = app()
    const compiler = {
      context: root,
      options: {
        module: { rules: [] as { use: { options: { session: string } }[] }[] },
      },
      webpack: { WebpackError: Error },
      hooks: {
        thisCompilation: tap("thisCompilation"),
        invalid: tap("invalid"),
        watchRun: tap("watchRun"),
        done: tap("done"),
      },
    }
    new KiranaPlugin({ driver: { importModule: (url) => import(url) } }).apply(
      compiler as unknown as Compiler
    )
    await hooks.watchRun!()
    await hooks.watchRun!()
    const session = sessions.get(
      compiler.options.module.rules[1]!.use[0]!.options.session
    )!
    const live = session.live!
    expect(readFileSync(live, "utf8")).toBe("")
    const dependencies: string[] = []
    const answer = await new Promise<string | undefined>((resolve) =>
      kiranaLoader.call(
        {
          resourcePath: session.stylesheetFile,
          resourceQuery: "",
          getOptions: () => ({
            session: [...sessions].find(([, value]) => value === session)![0],
          }),
          async: () => (_: Error | null, code?: string) => resolve(code),
          addDependency: (file: string) => void dependencies.push(file),
          emitWarning: () => {},
        },
        ""
      )
    )
    expect(dependencies).toEqual([live])
    expect(answer).toContain("@layer kirana")
    await hooks.done!()
    expect(readFileSync(live, "utf8")).toContain("@layer kirana")
    await hooks.done!()
  })

  it("forwards changed files to the Driver", async () => {
    const hooks: Record<string, (value: unknown) => unknown> = {}
    const tap = (name: string) => ({
      tap: (_: string, hook: (value: unknown) => unknown) =>
        (hooks[name] = hook),
      tapPromise: (_: string, hook: (value: unknown) => unknown) =>
        (hooks[name] = hook),
    })
    const compiler = {
      context: app(),
      options: { module: { rules: [] } },
      webpack: {
        WebpackError: Error,
        Compilation: { PROCESS_ASSETS_STAGE_OPTIMIZE: 100 },
        sources: {
          RawSource: class {
            text: string
            constructor(text: string) {
              this.text = text
            }
            source() {
              return this.text
            }
          },
        },
      },
      hooks: {
        thisCompilation: tap("thisCompilation"),
        invalid: tap("invalid"),
        watchRun: tap("watchRun"),
        done: tap("done"),
      },
    } as unknown as Compiler
    // Not watching: `done` has nothing to keep up to date.
    new KiranaPlugin().apply(compiler)
    await hooks.done!(undefined)
    expect(compiler.options.module.rules).toHaveLength(2)
    hooks.invalid!(null)
    hooks.invalid!(path.join(compiler.context, "src/tokens.js"))

    // Only a CSS asset holding the placeholder is rewritten.
    let fill: () => Promise<void> = async () => {}
    const updated: string[] = []
    hooks.thisCompilation!({
      getAssets: () =>
        [
          ["main.js", PLACEHOLDER],
          ["other.css", "a{}"],
          ["main.css", `a{}${PLACEHOLDER}`],
        ].map(([name, text]) => ({ name, source: { source: () => text } })),
      updateAsset: (name: string, source: { source: () => string }) =>
        updated.push(`${name}: ${source.source()}`),
      hooks: {
        finishModules: { tapPromise: () => {} },
        processAssets: {
          tapPromise: (_: unknown, hook: () => Promise<void>) => (fill = hook),
        },
      },
    })
    await fill()
    expect(updated).toEqual([
      expect.stringMatching(/^main\.css: a\{\}@layer kirana/),
    ])
  })
})
