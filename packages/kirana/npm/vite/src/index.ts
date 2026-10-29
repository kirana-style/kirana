/**
 * The Vite host adapter (KRN-INT-001, KRN-INT-002): the Rolldown adapter's build path, plus the dev
 * server — the live stylesheet, CSS hot updates, and importers of changed tokens re-run through
 * HMR. It never interprets styles (D-028).
 */
import { createRequire } from "node:module"
import path from "node:path"

import { stylesheetPath } from "@kirana-style/compiler/host"
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
 * The gap that separates one burst of transforms from the next, and the longest a continuous stream
 * may hold an update back.
 *
 * An edit that arrives after `QUIET` of silence is sent at once, because KRN-PERF-004 gives the
 * whole round trip 50 ms and the watcher and the transform have already spent most of it. Transforms
 * that keep arriving are coalesced into one update at the end of the burst instead.
 */
const QUIET = 50
const BURST = 250

/**
 * How many times, `QUIET` apart, an update waits for a stylesheet module Vite has not analysed yet:
 * one second, far longer than a transform in flight takes, and soon over for a module no browser
 * asked for.
 */
const RETRIES = 20

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
 * The plugin, and a second pass after every other plugin's `generateBundle`. The first pass fills the
 * stylesheet asset early, before Astro inlines small stylesheets; a framework that adds its CSS asset
 * later in that hook (Qwik) is filled by the second. Vite flattens the pair in `plugins`.
 */
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

  /**
   * Tells browsers the stylesheet changed, once per burst of transforms (KRN-INT-009).
   *
   * The first transform after a quiet moment — someone saving a file — is sent immediately. While
   * transforms keep arriving, as they do through a cold start, the update is held and the timer
   * restarts, so hundreds of modules cost two updates rather than one each. `BURST` caps how long a
   * stream that never stops can hold one back.
   */
  const scheduleCssUpdate = () => {
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
   * by: `/node_modules/@kirana-style/core/stylesheet.css` in an installed app, `/@fs/…` when the package
   * lives outside the project root (a workspace).
   *
   * A module Vite has not analysed yet is one whose transform is still running, or one no browser
   * asked for. Vite's update stops at it without a word, and its HMR invalidation lets a running
   * transform cache the stylesheet it read before this change, which a reload would then serve. It is
   * invalidated as an edited file is instead, which discards that result, and the update is tried
   * again once Vite has analysed it.
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
  // Its hooks are typed by the `rolldown` package, and Vite types them with the Rolldown it runs on:
  // the same package in an application, but a bundled copy under Vite+ (this workspace), where the
  // identical shapes are distinct types.
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
     * The same per environment, with the runtime named up front, and the libraries bundled. The top-level `optimizeDeps`
     * above is the client's; a server environment that pre-bundles its dependencies (Cloudflare's
     * Worker, which runs in workerd) would pre-bundle the libraries and run them uncompiled. And
     * compiled output imports the runtime, which no source file names, so an environment that
     * discovers dependencies found it during the first request and optimised again: a page reload
     * in the browser, and in workerd a second React and a failed first page.
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
    },

    async hotUpdate({ file, modules }) {
      const affected = (await session()).invalidate(file)
      const extra = affected.flatMap((dependent) => [
        ...(this.environment.moduleGraph.getModulesByFile(dependent) ?? []),
      ])
      return extra.length ? [...modules, ...extra] : undefined
    },
  }
  const late: Plugin = {
    name: "kirana:late",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      async handler(_output, bundle) {
        await fill(bundle, this)
      },
    },
  }
  return [main, late]
}
