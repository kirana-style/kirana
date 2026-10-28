/**
 * The Rolldown host adapter (KRN-INT-001, KRN-INT-002). It selects modules, forwards transform
 * results, emits the stylesheet entry and forwards file changes to the Driver; it never interprets
 * styles (D-028).
 *
 * The Vite adapter is this plugin plus Vite's dev-server hooks, because Vite's plugin API extends
 * Rolldown's: one implementation of the build path serves both hosts. The one difference is CSS:
 * Vite bundles it, so the stylesheet entry is a placeholder Vite processes and the plugin fills in;
 * Rolldown alone does not, so the plugin emits the stylesheet as an asset of its own.
 */
import { COMPONENT, Driver } from "@kirana-style/compiler"
import type { DriverOptions } from "@kirana-style/compiler"
import {
  ASSET_QUERY,
  VIRTUAL,
  PLACEHOLDER,
  SCRIPT,
  STYLE_BEARING,
  cleanId,
  createReporter,
  fillStylesheet,
  renameAsset,
  stylesheetPath,
  definitionNames,
} from "@kirana-style/compiler/host"
import type { KiranaConfig } from "@kirana-style/core/config"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { OutputBundle, Plugin } from "rolldown"

/** A request for part of a Vue, Svelte or Astro component, which carries a query. */
const COMPONENT_PART = /\.(?:vue|svelte|astro)\?/

export type KiranaRolldownOptions = {
  /** The project root: where `kirana.config.*` and `@kirana-style/core` are found. Default: the working directory. */
  root?: string
  /** Options that override `kirana.config.*`. */
  config?: KiranaConfig
  /** Report `info` diagnostics (such as `dynamic-bridged`) as warnings. */
  reportInfo?: boolean
  /**
   * Where the stylesheet is written in the output, when Rolldown builds on its own. Rolldown does
   * not bundle CSS, so importing `@kirana-style/core/stylesheet.css` yields this name and the finished
   * stylesheet is emitted under it; link it from your HTML. Default `kirana.css`. Under Vite, which
   * bundles CSS, the stylesheet follows Vite's asset naming instead.
   */
  fileName?: string
  /**
   * `"dense"` gives a production build short class names (D-084): the condition and value hashes
   * in every chunk and in the stylesheet become codes of one or two characters, assigned from the
   * whole build, and everything the runtime merge reads stays. A development server keeps the
   * hashed names. Not available with a class map (`classes`), whose server-side helpers read hashed
   * names. Default `"hashed"`.
   */
  names?: "hashed" | "dense"
  /** Injected Driver options (tests). */
  driver?: Pick<DriverOptions, "native" | "importModule">
}

/** What a host that extends this plugin supplies. */
export type Host = {
  /** True while a dev server serves the live stylesheet instead of the placeholder. */
  development?: () => boolean
  /** A transform changed the stylesheet. */
  cssChanged?: () => void
  /** The host bundles CSS (Vite): the entry is a placeholder stylesheet it processes like any other. */
  bundlesCss?: boolean
  /**
   * False when something later renames the finished stylesheet itself (`@kirana-style/astro`, because
   * Astro links each page's CSS by the name it recorded before `generateBundle`): the asset is filled
   * where it is, and its name is added to `filled`.
   */
  renames?: boolean
}

/**
 * The plugin, with the session and the settings a host that extends it may change (the Vite
 * adapter sets the root from Vite's resolved configuration).
 */
export function createKirana(
  options: KiranaRolldownOptions = {},
  host: Host = {}
) {
  const state = { root: options.root ?? process.cwd(), stylesheetFile: "" }
  let driver: Promise<Driver> | undefined
  const reporter = createReporter(options)
  const renamed = new Map<string, string>()
  /** Stylesheet assets filled in place (`Host.renames` false), by output file name. */
  const filled = new Set<string>()
  const development = () => host.development?.() ?? false
  const fileName = options.fileName ?? "kirana.css"
  const dense = () => options.names === "dense" && !development()
  /**
   * Every variable token the bundle's chunks and other files name, across environments, and the
   * ones the last stylesheet left out by identity (D-086): a token only code names is written when
   * the finished bundle still names it, and a chunk rendered later must not name one left out.
   */
  const named = new Set<string>()
  let pruned = new Map<string, string>()

  const session = () => {
    driver ??= Driver.create({
      root: state.root,
      config: options.config,
      ...options.driver,
    })
    return driver
  }
  const stylesheetFile = () =>
    (state.stylesheetFile ||= stylesheetPath(state.root))

  const plugin = {
    name: "kirana",

    async buildStart() {
      const compiler = await session()
      // Vite compiles the same modules for the client and again for the server, and a dev server
      // or a watch build sends unchanged ones again: each is answered from its first transform
      // while its source and what it read are unchanged (KF-063).
      compiler.reuseTransforms()
      if (dense()) {
        if (compiler.classModules.length > 0) {
          throw new Error(
            'kirana: `names: "dense"` cannot be used with a class map (`classes`): server templates read hashed names'
          )
        }
        compiler.markDense()
      }
    },

    async renderChunk(
      this: { error: (message: string) => never },
      code: string,
      chunk: { fileName: string },
      output: { sourcemap?: boolean | "inline" | "hidden" | null }
    ) {
      if (development()) return null
      const compiler = await session()
      const names = definitionNames(code, compiler.prefix)
      const late = names.filter((name) => pruned.has(name))
      const tokens = late.filter((name) => name.startsWith("--"))
      const keyframes = late.filter((name) => !name.startsWith("--"))
      if (tokens.length > 0) {
        const list = tokens
          .map((name) => `${pruned.get(name)} (${name})`)
          .join(", ")
        this.error(
          `kirana: ${chunk.fileName} reads tokens the stylesheet left out: ${list}. Nothing the stylesheet's own build bundled named them at runtime. Declare each one \`runtime: true\` in defineTokens (D-086).`
        )
      }
      if (keyframes.length > 0) {
        this.error(
          `kirana: ${chunk.fileName} names keyframes the stylesheet left out: ${keyframes.join(", ")}. Nothing the stylesheet's own build bundled named them. Apply them in a style a module of that build compiles (\`animationName\`), so a rule reads them (D-094).`
        )
      }
      for (const name of names) named.add(name)
      if (!dense()) return null
      // The renaming's map only for a build that writes maps: it is most of the pass (KF-061).
      return (
        compiler.dense(code, chunk.fileName, Boolean(output.sourcemap)) ?? null
      )
    },

    load: {
      // No `node_modules` exclusion here: in an installed app the stylesheet entry lives there.
      filter: { id: [/stylesheet\.css/, COMPONENT] },
      async handler(this, id: string) {
        // A Vue, Svelte or Astro component is compiled as it is read, before any framework plugin's
        // `transform` — Astro's compiles `.astro` files ahead of every user plugin, so a transform
        // would only ever see its output (design-notes/sfc-masking.md).
        if (COMPONENT.test(id)) {
          // An installed component is compiled only when its package is in `libraries`.
          const compiler = await session()
          if (!compiler.compiles(id)) return null
          const source = await readFile(id, "utf8")
          // Vite watches a file outside the root only when it reads the file itself; a component read
          // here, from a workspace package beside the app, would otherwise never hot-reload (KF-020).
          this.addWatchFile(id)
          const result = await compiler.transformComponent(id, source)
          for (const dependency of result.dependencies)
            this.addWatchFile(dependency)
          reporter.module(this, id, source, result.diagnostics)
          if (result.cssChanged) host.cssChanged?.()
          return result.code === undefined
            ? null
            : { code: result.code, map: result.map }
        }
        if (cleanId(id) !== stylesheetFile()) return null
        // Rolldown alone: the import is a module naming the file emitted at the end of the build.
        if (!host.bundlesCss) {
          return {
            code: `export default ${JSON.stringify(fileName)}`,
            moduleType: "js" as const,
          }
        }
        // `?inline` asks for the stylesheet as a string: in development that is the live stylesheet
        // (SvelteKit's server render inlines CSS this way). `?url` and `?raw`, and `?inline` in a
        // build, are Vite's to answer from the file.
        if (ASSET_QUERY.test(id)) {
          return development() && /[?&]inline\b/.test(id)
            ? (await session()).stylesheet(false)
            : null
        }
        return development() ? (await session()).stylesheet(false) : PLACEHOLDER
      },
    },

    transform: {
      filter: {
        id: {
          include: SCRIPT,
          // A framework's own requests for a component's parts (`Card.vue?vue&type=script&lang.ts`)
          // hold what it derived from the component, which `load` compiled already.
          // Generated modules (`virtual:…`, `\0…`) hold a plugin's code, never a project's styles.
          // Installed packages are excluded in the handler, which knows `libraries`.
          exclude: [ASSET_QUERY, COMPONENT_PART, VIRTUAL],
        },
        code: STYLE_BEARING,
      },
      async handler(this, code: string, id: string) {
        const file = cleanId(id)
        const compiler = await session()
        if (!compiler.compiles(file)) return null
        // A build compiles off the bundler's thread, so modules compile in parallel
        // (`Driver.transformAsync`). A dev server keeps one transform at a time: its stylesheet
        // updates follow the order transforms finish in.
        const result = development()
          ? compiler.transform(file, code)
          : await compiler.transformAsync(file, code)
        for (const dependency of result.dependencies)
          this.addWatchFile(dependency)
        reporter.module(this, file, code, result.diagnostics)
        if (result.cssChanged) host.cssChanged?.()
        return result.code === undefined
          ? null
          : { code: result.code, map: result.map }
      },
    },

    /** A watch rebuild: modules that read the changed file's tokens or relations compile again. */
    async watchChange(id: string) {
      ;(await session()).invalidate(id)
    },

    async buildEnd() {
      if (development()) return
      reporter.project(this, state.root, (await session()).diagnostics())
    },

    // First, so every plugin that reads CSS assets reads the finished stylesheet: Astro inlines
    // small stylesheets into its pages in its own `generateBundle`. Vite writes HTML later from each
    // chunk's `viteMetadata.importedCss`, which is renamed here along with the asset.
    generateBundle: {
      order: "pre",
      async handler(_output, bundle) {
        if (!host.bundlesCss) {
          const css = await finished(bundle)
          this.emitFile({ type: "asset", fileName, source: css })
          return
        }
        await fill(bundle, this.emitFile.bind(this))
      },
    },
  } satisfies Plugin

  /**
   * The stylesheet for this bundle (D-086, D-094): the token and keyframes names its other files
   * hold join the chunks', and the definitions left out are kept for the chunks rendered after it.
   */
  const finished = async (bundle: OutputBundle) => {
    const compiler = await session()
    for (const file of Object.values(bundle)) {
      if (file.type === "asset" && typeof file.source === "string")
        for (const name of definitionNames(file.source, compiler.prefix))
          named.add(name)
    }
    const result = compiler.finishedStylesheet(named, dense())
    pruned = new Map(
      result.pruned.map((token) => [token.variable, token.identity])
    )
    return result.css
  }

  /**
   * Fills every stylesheet asset still holding the placeholder, renaming it by content unless the
   * host keeps names, and points the chunks and assets that named it at the new name. A second pass
   * finds nothing to do, so a host may run it again later in `generateBundle` for assets another
   * plugin added after the first pass (Qwik's).
   */
  const fill = async (
    bundle: OutputBundle,
    emitFile: (file: {
      type: "asset"
      fileName: string
      source: string
    }) => unknown
  ) => {
    const css = await finished(bundle)
    for (const [key, asset] of Object.entries(bundle)) {
      if (asset.type !== "asset") continue
      const source = fillStylesheet(String(asset.source), css)
      if (source === undefined) continue
      if (host.renames === false) {
        asset.source = source
        filled.add(asset.fileName)
        continue
      }
      const hashed =
        renamed.get(asset.fileName) ?? renameAsset(asset.fileName, source)
      renamed.set(asset.fileName, hashed)
      delete bundle[key]
      emitFile({ type: "asset", fileName: hashed, source })
    }
    // Every rename so far, not only this pass's: a server bundle names the client's asset.
    for (const [from, to] of renamed) {
      const oldBase = path.posix.basename(from)
      const newBase = path.posix.basename(to)
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") {
          file.code = file.code.replaceAll(oldBase, newBase)
          const imported = (
            file as { viteMetadata?: { importedCss: Set<string> } }
          ).viteMetadata?.importedCss
          if (imported?.delete(from)) imported.add(to)
        } else if (typeof file.source === "string") {
          file.source = file.source.replaceAll(oldBase, newBase)
        }
      }
    }
  }

  return { plugin, session, state, filled, fill }
}

export default function kirana(options: KiranaRolldownOptions = {}): Plugin {
  return createKirana(options).plugin
}
