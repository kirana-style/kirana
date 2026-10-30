/**
 * Reading registry documents (KRN-DX-022, KRN-DX-023, KRN-DX-026): where a reference points, a
 * registry's headers with the environment's values, and a document fetched or read from disk, afresh
 * every time (D-049). Over the network only `https:`, or `http:` from the machine itself.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { check } from "./check.ts"
import type { Kind } from "./check.ts"
import type { Registry, Settings } from "./settings.ts"

/** What reading needs from the outside world; tests replace it. */
export type Io = {
  fetch?: typeof fetch
  env?: Readonly<Record<string, string | undefined>>
  /** Milliseconds a request may take; 30 seconds by default. */
  timeout?: number
}

/** A document that could not be read, or that is not what was asked for: what, and why. */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RegistryError"
  }
}

export const DEFAULT_TIMEOUT = 30_000

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** A namespace and a name, from `@namespace/name`; anything else is a name in `@kirana`. */
export function parseReference(reference: string): {
  namespace: string
  name: string
} {
  const slash = reference.indexOf("/")
  return reference.startsWith("@") && slash > 0
    ? { namespace: reference.slice(0, slash), name: reference.slice(slash + 1) }
    : { namespace: "@kirana", name: reference }
}

/** Where a registry's document is: its template with the name, as a URL; a path becomes a `file:` URL. */
export function locate(template: string, name: string, root: string): URL {
  const filled = template.replaceAll("{name}", name)
  // A scheme, but not a Windows drive (`C:\`), which is a path.
  return /^[a-z][a-z0-9+.-]+:/i.test(filled)
    ? new URL(filled)
    : pathToFileURL(path.resolve(root, filled))
}

/** A registry's headers with each `${NAME}` read from the environment; one that is not set stops. */
export function expandHeaders(
  registry: Registry,
  env: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [header, value] of Object.entries(registry.headers))
    headers[header] = value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
      const found = env[name]
      if (found === undefined)
        throw new RegistryError(
          `${registry.namespace}: its header ${header} reads \${${name}}, which is not set`
        )
      return found
    })
  return headers
}

/** Whether a document may be read from there: disk, `https:`, or `http:` from this machine. */
function allowed(url: URL): boolean {
  if (url.protocol === "https:" || url.protocol === "file:") return true
  return url.protocol === "http:" && LOOPBACK.has(url.hostname)
}

const refusal = (url: URL) =>
  `${url.href}: only https, or http from this machine, can be fetched`

function parse(text: string, where: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new RegistryError(`${where}: not JSON: ${(error as Error).message}`)
  }
}

/** A document's JSON, from disk or over the network, with these headers. */
export async function fetchJson(
  url: URL,
  headers: Readonly<Record<string, string>>,
  io: Io = {}
): Promise<unknown> {
  if (!allowed(url)) throw new RegistryError(refusal(url))
  if (url.protocol === "file:") {
    const file = fileURLToPath(url)
    let text: string
    try {
      text = await readFile(file, "utf8")
    } catch (error) {
      throw new RegistryError(`${file}: ${(error as Error).message}`)
    }
    return parse(text, file)
  }
  const timeout = io.timeout ?? DEFAULT_TIMEOUT
  let response: Response
  try {
    response = await (io.fetch ?? fetch)(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    })
  } catch (error) {
    // Node's fetch says only "fetch failed"; what failed (a name not found, a refused
    // connection) is its cause.
    const cause = (error as { cause?: unknown }).cause
    const reason =
      (error as Error).name === "TimeoutError"
        ? `took longer than ${timeout / 1000} seconds`
        : `could not be fetched: ${(cause instanceof Error ? cause : (error as Error)).message}`
    throw new RegistryError(`${url.href}: ${reason}`)
  }
  const final = new URL(response.url || url.href)
  if (!allowed(final))
    throw new RegistryError(`${url.href}: redirected to ${refusal(final)}`)
  if (!response.ok)
    throw new RegistryError(
      `${url.href}: answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    )
  return parse(await response.text(), url.href)
}

/** A reference's registry, or the namespaces the project knows when it names none of them. */
export function registryOf(namespace: string, settings: Settings): Registry {
  const registry = settings.registries.get(namespace)
  if (registry) return registry
  throw new RegistryError(
    `${namespace} is not a registry this project knows: ${[...settings.registries.keys()].join(", ")} (ui.registries in kirana.config)`
  )
}

/**
 * A registry document as a reference names it (`@acme/card`, `button`, `@acme/index`), fetched
 * with its registry's headers, and where it came from. Not checked: `read` checks.
 */
export async function fetchReference(
  reference: string,
  settings: Settings,
  io: Io = {}
): Promise<{ url: URL; document: unknown }> {
  const { namespace, name } = parseReference(reference)
  const registry = registryOf(namespace, settings)
  const url = locate(registry.template, name, settings.root)
  const headers = expandHeaders(registry, io.env ?? process.env)
  return { url, document: await fetchJson(url, headers, io) }
}

/** What a fetched document must be: an index for `index`, else an item of that name. */
export function expectation(
  reference: string,
  document: unknown,
  kind: Kind
): string | undefined {
  const { name } = parseReference(reference)
  const wanted: Kind = name === "index" ? "index" : "item"
  if (kind !== wanted)
    return `is ${kind === "index" ? "an" : "a"} ${kind}, not the ${wanted} asked for`
  const actual = (document as { name?: unknown }).name
  if (wanted === "item" && actual !== name)
    return `is the item ${JSON.stringify(actual)}, not ${name}`
  return undefined
}

/**
 * A registry document, read and checked: it must be the kind and the item asked for, and valid.
 * Anything else is a `RegistryError` naming the document.
 */
export async function read(
  reference: string,
  settings: Settings,
  io: Io = {}
): Promise<{ url: URL; kind: Kind; document: unknown }> {
  const { url, document } = await fetchReference(reference, settings, io)
  const { kind, problems } = check(document)
  const wrong = expectation(reference, document, kind)
  if (wrong !== undefined) throw new RegistryError(`${url.href}: ${wrong}`)
  if (problems.length > 0)
    // The kind and the name are right, so the document is an object: no problem is at its root.
    throw new RegistryError(
      problems
        .map((problem) => `${url.href}: ${problem.pointer} ${problem.message}`)
        .join("\n")
    )
  return { url, kind, document }
}
