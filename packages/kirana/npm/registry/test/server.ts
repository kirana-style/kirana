/**
 * A registry served on this machine for the tests, and the documents it serves: `card` and an index,
 * one that needs a header, a broken one and a 404.
 */
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { hashOf } from "../src/check.ts"

export const CARD = {
  name: "card",
  type: "component",
  version: "0.1.0",
  styles: [
    { path: "card.styles.ts", type: "ui", content: "", hash: hashOf("") },
  ],
}

export const INDEX = {
  name: "Acme",
  items: [{ name: "card", type: "component", version: "0.1.0" }],
}

/** Starts the registry; `url` is its origin, `close` stops it. */
export async function serve(): Promise<{
  url: string
  seen: Record<string, string | undefined>[]
  close: () => Promise<void>
}> {
  const seen: Record<string, string | undefined>[] = []
  const server = createServer((request, response) => {
    seen.push({
      path: request.url,
      authorization: request.headers.authorization,
    })
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" })
      response.end(typeof body === "string" ? body : JSON.stringify(body))
    }
    if (request.url === "/r/card.json") return json(200, CARD)
    if (request.url === "/r/index.json") return json(200, INDEX)
    if (request.url === "/r/broken.json") return json(200, "{")
    if (request.url === "/r/private.json")
      return request.headers.authorization === "Bearer secret"
        ? json(200, { ...CARD, name: "private" })
        : json(401, { error: "unauthorized" })
    json(404, { error: "not found" })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
