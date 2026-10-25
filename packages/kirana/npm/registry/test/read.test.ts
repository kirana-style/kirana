import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test"

import {
  DEFAULT_TIMEOUT,
  expandHeaders,
  expectation,
  fetchJson,
  fetchReference,
  locate,
  parseReference,
  read,
  registryOf,
  RegistryError,
} from "../src/read.ts"
import type { Registry, Settings } from "../src/settings.ts"
import { CARD, INDEX, serve } from "./server.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-read-"))
let registry: Awaited<ReturnType<typeof serve>>
beforeAll(async () => {
  registry = await serve()
})
afterAll(async () => {
  await registry.close()
  rmSync(root, { recursive: true, force: true })
})

/** Settings with these registries besides a `@kirana` that points at the local server. */
function settings(registries: Registry[] = []): Settings {
  const all: Registry[] = [
    {
      namespace: "@kirana",
      template: `${registry.url}/r/{name}.json`,
      headers: {},
    },
    ...registries,
  ]
  return {
    root,
    registries: new Map(all.map((entry) => [entry.namespace, entry])),
    aliases: {},
    iconLibrary: "lucide",
    design: {},
  }
}

/** A `fetch` that answers with this, for what the local server cannot do (redirect elsewhere). */
const answering =
  (response: Partial<Response>): typeof fetch =>
  async () =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "",
      text: async () => "{}",
      ...response,
    }) as Response

const failing =
  (error: Error): typeof fetch =>
  async () => {
    throw error
  }

describe("KRN-DX-026 references", () => {
  it("read a namespace and a name, or @kirana's name alone", () => {
    expect(parseReference("@acme/card")).toEqual({
      namespace: "@acme",
      name: "card",
    })
    expect(parseReference("button")).toEqual({
      namespace: "@kirana",
      name: "button",
    })
  })

  it("know only the registries the project names", () => {
    expect(registryOf("@kirana", settings()).namespace).toBe("@kirana")
    expect(() => registryOf("@acme", settings())).toThrow(
      "@acme is not a registry this project knows: @kirana (ui.registries in kirana.config)"
    )
  })
})

describe("KRN-DX-022 where a document is", () => {
  it("fills the template; a path is read from the configuration's directory", () => {
    expect(locate("https://acme.dev/r/{name}.json", "card", root).href).toBe(
      "https://acme.dev/r/card.json"
    )
    expect(locate("public/r/{name}.json", "card", root).href).toBe(
      pathToFileURL(path.join(root, "public/r/card.json")).href
    )
    expect(locate("file:///srv/r/{name}.json", "card", root).href).toBe(
      "file:///srv/r/card.json"
    )
  })
})

describe("KRN-DX-023 headers", () => {
  it("read the environment, and stop on a variable that is not set without printing a value", () => {
    const acme: Registry = {
      namespace: "@acme",
      template: "",
      headers: { Authorization: "Bearer ${TOKEN}", "X-Team": "ui" },
    }
    expect(expandHeaders(acme, { TOKEN: "secret" })).toEqual({
      Authorization: "Bearer secret",
      "X-Team": "ui",
    })
    expect(() => expandHeaders(acme, {})).toThrow(
      "@acme: its header Authorization reads ${TOKEN}, which is not set"
    )
  })
})

describe("KRN-DX-026 fetching", () => {
  it("reads https, http from this machine, and files; refuses the rest", async () => {
    expect(await fetchJson(new URL(`${registry.url}/r/card.json`), {})).toEqual(
      CARD
    )
    writeFileSync(path.join(root, "card.json"), JSON.stringify(CARD))
    expect(
      await fetchJson(pathToFileURL(path.join(root, "card.json")), {})
    ).toEqual(CARD)
    await expect(
      fetchJson(new URL("http://acme.dev/r/card.json"), {})
    ).rejects.toThrow(
      "http://acme.dev/r/card.json: only https, or http from this machine, can be fetched"
    )
    await expect(
      fetchJson(new URL("ftp://acme.dev/card.json"), {})
    ).rejects.toThrow(RegistryError)
    expect(
      await fetchJson(
        new URL("https://acme.dev/r/card.json"),
        {},
        { fetch: answering({}) }
      )
    ).toEqual({})
  })

  it("says what failed: the status, a body that is not JSON, a missing file", async () => {
    await expect(
      fetchJson(new URL(`${registry.url}/r/missing.json`), {})
    ).rejects.toThrow(`${registry.url}/r/missing.json: answered 404 Not Found`)
    await expect(
      fetchJson(
        new URL("https://acme.dev/r/x.json"),
        {},
        {
          fetch: answering({ ok: false, status: 500, statusText: "" }),
        }
      )
    ).rejects.toThrow("https://acme.dev/r/x.json: answered 500")
    await expect(
      fetchJson(new URL(`${registry.url}/r/broken.json`), {})
    ).rejects.toThrow(`${registry.url}/r/broken.json: not JSON:`)
    writeFileSync(path.join(root, "broken.json"), "{")
    await expect(
      fetchJson(pathToFileURL(path.join(root, "broken.json")), {})
    ).rejects.toThrow(`${path.join(root, "broken.json")}: not JSON:`)
    await expect(
      fetchJson(pathToFileURL(path.join(root, "nothing.json")), {})
    ).rejects.toThrow(path.join(root, "nothing.json"))
  })

  it("sends the headers it is given", async () => {
    await fetchJson(new URL(`${registry.url}/r/private.json`), {
      Authorization: "Bearer secret",
    })
    expect(registry.seen.at(-1)).toEqual({
      path: "/r/private.json",
      authorization: "Bearer secret",
    })
  })

  it("gives up after its timeout, and says why a request failed", async () => {
    const timeout = Object.assign(new Error("aborted"), {
      name: "TimeoutError",
    })
    expect(DEFAULT_TIMEOUT).toBe(30_000)
    await expect(
      fetchJson(
        new URL("https://acme.dev/r/x.json"),
        {},
        { fetch: failing(timeout), timeout: 1500 }
      )
    ).rejects.toThrow("https://acme.dev/r/x.json: took longer than 1.5 seconds")
    await expect(
      fetchJson(
        new URL("https://acme.dev/r/x.json"),
        {},
        { fetch: failing(timeout) }
      )
    ).rejects.toThrow("took longer than 30 seconds")
    await expect(
      fetchJson(
        new URL("https://acme.dev/r/x.json"),
        {},
        {
          fetch: failing(new Error("getaddrinfo ENOTFOUND acme.dev")),
        }
      )
    ).rejects.toThrow(
      "https://acme.dev/r/x.json: could not be fetched: getaddrinfo ENOTFOUND acme.dev"
    )
    const node = Object.assign(new TypeError("fetch failed"), {
      cause: new Error("getaddrinfo ENOTFOUND ui.kirana.style"),
    })
    await expect(
      fetchJson(
        new URL("https://ui.kirana.style/r/x.json"),
        {},
        { fetch: failing(node) }
      )
    ).rejects.toThrow(
      "https://ui.kirana.style/r/x.json: could not be fetched: getaddrinfo ENOTFOUND ui.kirana.style"
    )
  })

  it("refuses a redirect to a place it would not fetch from", async () => {
    await expect(
      fetchJson(
        new URL("https://acme.dev/r/x.json"),
        {},
        {
          fetch: answering({ url: "http://evil.example/x.json" }),
        }
      )
    ).rejects.toThrow(
      "https://acme.dev/r/x.json: redirected to http://evil.example/x.json: only https, or http from this machine, can be fetched"
    )
  })
})

describe("KRN-DX-026 reading a reference", () => {
  it("fetches with its registry's headers, from the environment it is given", async () => {
    const acme: Registry = {
      namespace: "@acme",
      template: `${registry.url}/r/{name}.json`,
      headers: { Authorization: "Bearer ${ACME_TOKEN}" },
    }
    const { url, document } = await fetchReference(
      "@acme/private",
      settings([acme]),
      {
        env: { ACME_TOKEN: "secret" },
      }
    )
    expect(url.href).toBe(`${registry.url}/r/private.json`)
    expect((document as { name: string }).name).toBe("private")
    // The process's own environment by default: @kirana sends no header.
    expect((await fetchReference("card", settings())).document).toEqual(CARD)
  })

  it("must be the kind and the item asked for", () => {
    expect(expectation("@acme/card", CARD, "item")).toBeUndefined()
    expect(expectation("@acme/index", INDEX, "index")).toBeUndefined()
    expect(expectation("@acme/card", INDEX, "index")).toBe(
      "is an index, not the item asked for"
    )
    expect(expectation("@acme/index", CARD, "item")).toBe(
      "is a item, not the index asked for"
    )
    expect(expectation("@acme/button", CARD, "item")).toBe(
      'is the item "card", not button'
    )
  })

  it("reads, checks, and names the document in what went wrong", async () => {
    const { kind, document } = await read("card", settings())
    expect(kind).toBe("item")
    expect(document).toEqual(CARD)
    expect((await read("index", settings())).kind).toBe("index")
    await expect(read("private", settings())).rejects.toThrow(
      `${registry.url}/r/private.json: answered 401 Unauthorized`
    )
    writeFileSync(
      path.join(root, "wrong.json"),
      JSON.stringify({ ...CARD, name: "wrong", version: "1" })
    )
    const local: Registry = {
      namespace: "@local",
      template: "{name}.json",
      headers: {},
    }
    await expect(read("@local/wrong", settings([local]))).rejects.toThrow(
      `${pathToFileURL(path.join(root, "wrong.json")).href}: /version must match`
    )
    await expect(read("@local/card", settings([local]))).resolves.toMatchObject(
      {
        kind: "item",
      }
    )
    writeFileSync(path.join(root, "list.json"), JSON.stringify(INDEX))
    await expect(read("@local/list", settings([local]))).rejects.toThrow(
      "list.json: is an index, not the item asked for"
    )
  })
})
