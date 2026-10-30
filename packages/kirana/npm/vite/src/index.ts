/**
 * The Vite host adapter (KRN-INT-001, KRN-INT-002): the Rolldown adapter's build path, plus the dev
 * server — the live stylesheet, CSS hot updates, and importers of changed tokens re-run through
 * HMR. It never interprets styles (D-028).
 */
import { createRequire } from "node:module"
import path from "node:path"

import {
  ASSET_QUERY,
  cleanId,
  stylesheetPath,
} from "@kirana-style/compiler/host"
import { createKirana } from "@kirana-style/rolldown"
import type { KiranaRolldownOptions } from "@kirana-style/rolldown"
import type { Plugin, ViteDevServer } from "vite"

export {
  PLACEHOLDER,
  cleanId,
  readSource,
  renameAsset,
} from "@kirana-style/compiler/host"

export { cssLayer, wrapInLayer } from "./layer.ts"

export type KiranaViteOptions = Omit<
  KiranaRolldownOptions,
  "root" | "fileName"
> & {
  /**
   * False when an integration renames the finished stylesheet after the build (`@kirana-style/astro`);
   * the plugin's `api.filled` lists the files it filled.
   */
  renameStylesheet?: boolean
}

/**
 * `QUIET` is the silence that ends a burst of transforms, `BURST` the longest a continuous stream may
 * hold an update back. An edit after `QUIET` of silence is sent at once: KRN-PERF-004 gives the whole
 * round trip 50 ms, and the watcher and the transform have spent most of it.
 */
const QUIET = 50
const BURST = 250

/**
 * How many times, `QUIET` apart, an update waits for a stylesheet module Vite has not analysed yet:
 * one second, far longer than a transform in flight takes, and soon over for a module no browser
 * asked for.
 */
const RETRIES = 20

/**
 * What the stylesheet module sends the dev server when it runs in the page: the revision of the
 * stylesheet it holds (KF-071).
 */
const HELD = "kirana:stylesheet"

/** The module compiled output imports for the runtime merge (`kirana_transform`). */
const RUNTIME = "@kirana-style/core/internal"

/**
 * Whether `specifier` resolves from the project, so naming it to Vite cannot fail: an application
 * that only uses a listed library may not depend on `@kirana-style/core` itself.
 */
function resolves(root: string, specifier: string): boolean {
  try {
    createRequire(path.join(root, "package.json")).resolve(specifier)
    return true
  } catch {
    return false
  }
}

/**
 * Whether the environment a transform runs in writes source maps: its `build.sourcemap`, which
 * Vite leaves `false` unless asked. A context without an environment gets maps.
 */
function sourcemapsOf(context: unknown): boolean {
  const environment = (
    context as { environment?: { config: { build: { sourcemap?: unknown } } } }
  ).environment
  return (
    environment === undefined || Boolean(environment.config.build.sourcemap)
  )
}

/**
 * The plugin, and a second pass after every other plugin's `generateBundle`. The first pass fills the
 * stylesheet asset early, before Astro inlines small stylesheets; a framework that adds its CSS asset
 * later in that hook (Qwik) is filled by the second. Vite flattens the pair in `plugins`.
 */
export default function kirana(
  options: KiranaViteOptions = {}
): [Plugin, Plugin] {
  /**
   * Every dev server this plugin serves. Usually one; Nuxt runs one for the client and one for the
   * server with the same plugins, and the update must reach the one the browser is connected to.
   */
  const servers = new Set<ViteDevServer>()
  let stylesheetFile = ""
  let pending: ReturnType<typeof setTimeout> | undefined
  let deadline = 0
  let sent = 0
  let retry: ReturnType<typeof setTimeout> | undefined
  /** How many times a transform changed the stylesheet, and the count the last one served had. */
  let revision = 0
  let served = 0

  /**
   * Tells browsers the stylesheet changed, once per burst of transforms (KRN-INT-009): a save after a
   * quiet moment is sent at once, and a cold start's hundreds of transforms cost two updates, not one
   * each.
   */
  const scheduleCssUpdate = () => {
    revision++
    if (servers.size === 0) return
    const now = Date.now()
    if (pending === undefined && now - sent >= QUIET) {
      sent = now
      push()
      return
    }
    if (pending === undefined) deadline = now + BURST
    else clearTimeout(pending)
    pending = setTimeout(
      () => {
        pending = undefined
        sent = Date.now()
        push()
      },
      Math.max(0, Math.min(QUIET, deadline - now))
    )
  }

  /**
   * Reloads the stylesheet module and tells the client to swap it, under the URL the client knows it
   * by (`/node_modules/…` installed, `/@fs/…` in a workspace).
   *
   * Vite's update stops silently at a module it has not analysed yet, and a reload would serve the
   * stylesheet a running transform cached before this change. Such a module is invalidated as an
   * edited file is, which discards that result, and the update is retried.
   */
  const push = (attempt = 0) => {
    clearTimeout(retry)
    let unanalysed = false
    for (const server of servers) {
      const environment = server.environments.client
      const modules = [
        ...(environment.moduleGraph.getModulesByFile(stylesheetFile) ?? []),
      ]
      for (const module of modules) {
        if (module.isSelfAccepting === undefined) {
          environment.moduleGraph.invalidateModule(module)
          unanalysed = true
        } else void environment.reloadModule(module)
      }
      const urls = new Set(modules.map((module) => module.url))
      if (urls.size === 0) urls.add(`/@fs${stylesheetFile}`)
      server.ws.send({
        type: "update",
        updates: [...urls].map((url) => ({
          type: "css-update" as const,
          path: url,
          acceptedPath: url,
          timestamp: Date.now(),
        })),
      })
    }
    if (unanalysed && attempt < RETRIES)
      retry = setTimeout(() => push(attempt + 1), QUIET)
  }

  const { renameStylesheet, ...rest } = options
  const { plugin, session, state, filled, fill } = createKirana(rest, {
    development: () => servers.size > 0,
    cssChanged: scheduleCssUpdate,
    bundlesCss: true,
    renames: renameStylesheet,
    sourcemaps: (context) => sourcemapsOf(context),
  })
  // Vite reports changes through `hotUpdate`, below; answering `watchChange` too would invalidate twice.
  // The cast: under Vite+ (this workspace) Vite types hooks with a bundled Rolldown, so the identical
  // shapes are distinct types.
  const { watchChange: _, ...build } = plugin as unknown as Plugin

  const main: Plugin = {
    ...build,
    enforce: "pre",
    /** Vite's channel between plugins: which stylesheet files were filled without renaming. */
    api: { filled },

    /**
     * Compiled libraries (KRN-INT-008), Kirana's own preset among them, must reach the plugin: Vite
     * would otherwise pre-bundle them in development and leave them external in server builds, and
     * their `css()` and `defineTokens()` calls would run uncompiled. Naming a package the project
     * does not have changes nothing.
     */
    async config(userConfig) {
      state.root = path.resolve(userConfig.root ?? process.cwd())
      const { libraries } = await session()
      return {
        optimizeDeps: { exclude: [...libraries] },
        ssr: { noExternal: [...libraries] },
      }
    },

    /**
     * The same per environment: the top-level `optimizeDeps` is the client's, and a server environment
     * that pre-bundles (Cloudflare's workerd) would run the libraries uncompiled. The runtime is named
     * up front because no source file imports it, so discovery would find it on the first request and
     * optimise again: a page reload, and in workerd a second React and a failed first page.
     */
    async configEnvironment(name, config) {
      const { libraries } = await session()
      const discovers =
        name === "client" || config.optimizeDeps?.noDiscovery === false
      return {
        optimizeDeps: {
          ...(name === "client" ? {} : { exclude: [...libraries] }),
          ...(discovers && resolves(state.root, RUNTIME)
            ? { include: [RUNTIME] }
            : {}),
        },
        // A server environment leaves dependencies external by default, so Node would import the
        // libraries as published: `ssr.noExternal` above reaches only `ssr`, not Astro 7's
        // `prerender` (KF-031).
        ...(name === "client"
          ? {}
          : { resolve: { noExternal: [...libraries] } }),
      }
    },

    configResolved(config) {
      state.root = config.root
      stylesheetFile = state.stylesheetFile = stylesheetPath(config.root)
    },

    configureServer(devServer) {
      servers.add(devServer)
      devServer.httpServer?.once("close", () => servers.delete(devServer))
      // A page that ran a stylesheet older than the current one missed an update: Vite's client
      // drops one for a module that has not run yet, and on a cold start every update can arrive
      // while the page is still loading its modules (KF-071).
      devServer.environments.client.hot.on(HELD, (held: number) => {
        if (held < revision) push()
      })
    },

    async hotUpdate({ file, modules }) {
      const affected = (await session()).invalidate(file)
      const extra = affected.flatMap((dependent) => [
        ...(this.environment.moduleGraph.getModulesByFile(dependent) ?? []),
      ])
      return extra.length ? [...modules, ...extra] : undefined
    },
  }
  /**
   * What runs after Vite's own plugins. On a dev server, the stylesheet module, once Vite's CSS
   * plugin has made it a script, reports the revision it holds when the page runs it; `load` notes
   * the revision of the stylesheet it reads. In a build, the stylesheets other plugins added are
   * filled.
   */
  const late: Plugin = {
    name: "kirana:late",
    enforce: "post",
    load: {
      order: "pre",
      filter: { id: /stylesheet\.css/ },
      handler(id) {
        if (cleanId(id) === stylesheetFile) served = revision
        return null
      },
    },
    transform: {
      order: "post",
      filter: { id: /stylesheet\.css/ },
      handler(code, id) {
        if (
          servers.size === 0 ||
          cleanId(id) !== stylesheetFile ||
          ASSET_QUERY.test(id)
        )
          return null
        return `${code}\nif (import.meta.hot) import.meta.hot.send(${JSON.stringify(HELD)}, ${served})\n`
      },
    },
    generateBundle: {
      order: "post",
      async handler(_output, bundle) {
        await fill(bundle, this)
      },
    },
  }
  return [main, late]
}
