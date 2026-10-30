/**
 * The Remix 3 host adapter. Remix compiles TypeScript and JSX itself (`node-tsx` on the server, the
 * asset server for the browser), so Kirana runs after both, on the compiled JSX calls. Client entries
 * render on the server too, so the server's one session has seen every module:
 *
 *   node --import remix/node-tsx --import @kirana-style/remix/node server.ts
 *   createAssetServer({ …, allowPackages: ["remix", "@kirana-style/core"], scripts: { loaders: [kiranaLoader] } })
 *   createRouter({ middleware: [stylesheet(), …] })   // serves /kirana.css
 */
import { fileURLToPath } from "node:url"

import { Driver, formatDiagnostics } from "@kirana-style/compiler"
import type { DriverOptions } from "@kirana-style/compiler"
import { shouldCompile } from "@kirana-style/compiler/host"

let shared: Driver | undefined

/** The process's compiler session, opened on first use in the working directory. */
export function session(options: Partial<DriverOptions> = {}): Driver {
  shared ??= Driver.createSync({ root: process.cwd(), ...options })
  return shared
}

/** Closes the session, so the next use opens a new one (tests, and a server that changes root). */
export function resetSession(): void {
  shared = undefined
}

/**
 * A module's compiled JavaScript with its styles compiled too, or `undefined` when it has none to
 * compile: not a file, an installed package, or no style in it. An error diagnostic fails the
 * module's load, as it fails a bundler's build; a warning is printed.
 */
export function compile(url: string, source: string): string | undefined {
  if (!url.startsWith("file:")) return undefined
  const file = fileURLToPath(url)
  const driver = session()
  if (!shouldCompile(file, source, driver.libraries)) return undefined
  const result = driver.transform(file, source, { map: false })
  const messages = formatDiagnostics(result.diagnostics, () => source)
  for (const [index, diagnostic] of result.diagnostics.entries()) {
    if (diagnostic.severity === "error") throw new Error(messages[index])
    if (diagnostic.severity === "warning") console.warn(messages[index])
  }
  return result.code ?? undefined
}

/**
 * A synchronous `load` hook in Node's shape: the next loader's output (`node-tsx`'s, the asset
 * server's), with its styles compiled. Node's `registerHooks` and the asset server's
 * `scripts.loaders` both take it; it is generic over their context and result types.
 */
export function kiranaLoader<
  LoadContext,
  Result extends { source?: string | ArrayBuffer | ArrayBufferView | null },
>(
  url: string,
  context: LoadContext,
  nextLoad: (url: string, context: LoadContext) => Result
): Result {
  const result = nextLoad(url, context)
  const source =
    typeof result.source === "string"
      ? result.source
      : result.source == null
        ? undefined
        : new TextDecoder().decode(result.source)
  const code = source === undefined ? undefined : compile(url, source)
  return code === undefined ? result : { ...result, source: code }
}

type Context = { request: Request; url: URL }

/**
 * Router middleware that answers `GET path` with the session's stylesheet; every other request goes
 * on. The stylesheet is computed when asked, so it holds every module compiled by then.
 */
export function stylesheet({
  path = "/kirana.css",
  minify = process.env.NODE_ENV === "production",
}: { path?: string; minify?: boolean } = {}) {
  return (
    context: Context,
    next: () => Response | Promise<Response>
  ): Response | Promise<Response> => {
    if (context.request.method !== "GET" || context.url.pathname !== path)
      return next()
    return new Response(session().stylesheet(minify), {
      headers: {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "no-cache",
      },
    })
  }
}
