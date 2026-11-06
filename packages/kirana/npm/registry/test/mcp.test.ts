import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test"

import { main } from "../src/index.ts"
import type { TOOLS } from "../src/mcp.ts"
import { PROTOCOL_VERSIONS, callTool, handle, runMcp } from "../src/mcp.ts"
import { version } from "../src/version.ts"
import { BUTTON, project } from "./fixtures.ts"
import { serve } from "./server.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-mcp-"))
let registry: Awaited<ReturnType<typeof serve>>
let kirana: string
beforeAll(async () => {
  registry = await serve()
  kirana = `${registry.url}/r/{name}.json`
})
afterAll(async () => {
  await registry.close()
  rmSync(root, { recursive: true, force: true })
})

/** The server's answers to these lines, given as chunks, each answer parsed. */
async function session(
  cwd: string,
  chunks: (string | Uint8Array)[]
): Promise<{ code: number; answers: unknown[] }> {
  let out = ""
  const input = (async function* () {
    yield* chunks
  })()
  const code = await runMcp([], cwd, (text) => void (out += text), {}, input)
  return {
    code,
    answers: out
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown),
  }
}

/** One request's answer. */
async function ask(
  cwd: string,
  method: string,
  params?: unknown,
  id: unknown = 1
) {
  return handle(
    { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) },
    cwd,
    {}
  )
}

/** A tool's answer: its text and whether it is an error. */
async function tool(cwd: string, name: string, args?: Record<string, unknown>) {
  const answer = (await ask(cwd, "tools/call", {
    name,
    ...(args === undefined ? {} : { arguments: args }),
  })) as {
    result: { content: { type: string; text: string }[]; isError?: boolean }
  }
  expect(answer.result.content).toHaveLength(1)
  expect(answer.result.content[0]!.type).toBe("text")
  return {
    text: answer.result.content[0]!.text,
    isError: answer.result.isError ?? false,
  }
}

describe("KRN-DX-035 kirana-style ui mcp: the protocol", () => {
  it("answers initialize in the revision asked for, else its newest", async () => {
    const cwd = project(root, kirana)
    expect(
      await ask(cwd, "initialize", { protocolVersion: "2025-06-18" })
    ).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: {
          name: "kirana-style-ui",
          title: "Kirana UI",
          version: await version(),
        },
        instructions: expect.stringContaining("get_add_command"),
      },
    })
    expect(
      (
        (await ask(
          cwd,
          "initialize",
          { protocolVersion: "1999-01-01" },
          "a"
        )) as {
          result: { protocolVersion: string }
        }
      ).result.protocolVersion
    ).toBe(PROTOCOL_VERSIONS[0])
    expect(
      (
        (await ask(cwd, "initialize")) as {
          result: { protocolVersion: string }
        }
      ).result.protocolVersion
    ).toBe(PROTOCOL_VERSIONS[0])
  })

  it("answers ping and lists its tools", async () => {
    expect(await ask(root, "ping")).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {},
    })
    const listed = (await ask(root, "tools/list")) as {
      result: { tools: typeof TOOLS }
    }
    expect(listed.result.tools.map((entry) => entry.name)).toEqual([
      "list_registries",
      "search_items",
      "view_items",
      "get_item_files",
      "get_add_command",
    ])
    for (const entry of listed.result.tools)
      expect(entry.inputSchema.type).toBe("object")
  })

  it("answers no notification, and refuses what is not a request", async () => {
    expect(
      await handle(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        root,
        {}
      )
    ).toBe(undefined)
    const invalid = (id: unknown) => ({
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "not a JSON-RPC 2.0 request" },
    })
    expect(await handle(null, root, {})).toEqual(invalid(null))
    expect(await handle([], root, {})).toEqual(invalid(null))
    expect(
      await handle({ jsonrpc: "1.0", id: 3, method: "ping" }, root, {})
    ).toEqual(invalid(3))
    expect(await handle({ jsonrpc: "2.0", id: "x" }, root, {})).toEqual(
      invalid("x")
    )
    expect(
      await handle({ jsonrpc: "2.0", id: {}, method: "ping" }, root, {})
    ).toEqual(invalid(null))
    expect(await ask(root, "resources/list")).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "no method resources/list" },
    })
  })

  it("refuses a call to no tool, or with arguments that are not an object", async () => {
    expect(await ask(root, "tools/call", { name: "nope" })).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32602, message: "no tool nope" },
    })
    expect(await ask(root, "tools/call")).toMatchObject({
      error: { code: -32602, message: "no tool undefined" },
    })
    for (const given of [[], null, "x"])
      expect(
        await ask(root, "tools/call", { name: "ping", arguments: given })
      ).toMatchObject({
        error: { code: -32602 },
      })
    expect(
      await ask(root, "tools/call", { name: "list_registries", arguments: [] })
    ).toMatchObject({
      error: { code: -32602, message: "arguments is an object" },
    })
    await expect(callTool("nope", {}, root, {})).rejects.toThrow(
      "no tool nope: list_registries, search_items"
    )
  })

  it("reads lines from stdin in any chunks, and answers each", async () => {
    const encoder = new TextEncoder()
    const ping = (id: number) =>
      JSON.stringify({ jsonrpc: "2.0", id, method: "ping" })
    const { code, answers } = await session(root, [
      `${ping(1)}\n\n`,
      encoder.encode(ping(2).slice(0, 10)),
      encoder.encode(`${ping(2).slice(10)}\n{oops\n`),
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
      ping(3),
    ])
    expect(code).toBe(0)
    expect(answers).toEqual([
      { jsonrpc: "2.0", id: 1, result: {} },
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "not JSON" },
      },
      { jsonrpc: "2.0", id: 2, result: {} },
      { jsonrpc: "2.0", id: 3, result: {} },
    ])
  })

  it("takes no arguments", async () => {
    let out = ""
    expect(
      await main(["mcp", "extra"], root, (text) => void (out += text))
    ).toBe(2)
    expect(out).toBe("kirana-style ui mcp takes no arguments\n")
    out = ""
    expect(
      await main(["mcp", "--stdio"], root, (text) => void (out += text))
    ).toBe(2)
    expect(out).toBe("kirana-style ui mcp: unknown option --stdio\n")
  })
})

describe("KRN-DX-035 kirana-style ui mcp: the tools", () => {
  it("lists the project's registries without their headers", async () => {
    const cwd = project(root, kirana, {
      "@private": {
        url: "https://x.dev/{name}.json",
        headers: { authorization: "Bearer ${TOKEN}" },
      },
    })
    const { text, isError } = await tool(cwd, "list_registries")
    expect(isError).toBe(false)
    expect(JSON.parse(text)).toEqual({
      root: cwd,
      framework: null,
      base: null,
      iconLibrary: "lucide",
      registries: [
        { namespace: "@kirana", url: kirana },
        { namespace: "@acme", url: "acme/{name}.json" },
        { namespace: "@private", url: "https://x.dev/{name}.json" },
      ],
    })
    expect(text).not.toContain("TOKEN")
    // The framework the settings name, else the one package.json lists.
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({ dependencies: { vue: "^3" } })
    )
    expect(
      JSON.parse((await tool(cwd, "list_registries")).text).framework
    ).toBe("vue")
    const set = mkdtempSync(path.join(root, "set-"))
    writeFileSync(
      path.join(set, "kirana.config.json"),
      JSON.stringify({
        ui: { framework: "svelte", base: "ark", iconLibrary: "tabler" },
      })
    )
    expect(JSON.parse((await tool(set, "list_registries")).text)).toMatchObject(
      {
        framework: "svelte",
        base: "ark",
        iconLibrary: "tabler",
      }
    )
  })

  it("searches every registry, or those named", async () => {
    const cwd = project(root, kirana)
    const all = JSON.parse((await tool(cwd, "search_items")).text) as {
      results: { reference: string }[]
      failures: unknown[]
    }
    expect(all.results.map((result) => result.reference)).toEqual([
      "@kirana/card",
      "@acme/button",
      "@acme/note",
      "@acme/login-01",
    ])
    const found = JSON.parse(
      (
        await tool(cwd, "search_items", {
          query: "LOGIN form",
          registries: ["@acme"],
        })
      ).text
    ) as { results: { reference: string }[] }
    expect(found.results.map((result) => result.reference)).toEqual([
      "@acme/login-01",
    ])
  })

  it("says a search failed only when nothing was found", async () => {
    const cwd = project(root, kirana, {
      "@gone": `${registry.url}/gone/{name}.json`,
    })
    const mixed = await tool(cwd, "search_items", { query: "button" })
    expect(mixed.isError).toBe(false)
    expect(JSON.parse(mixed.text).failures).toHaveLength(1)
    const failed = await tool(cwd, "search_items", { registries: ["@gone"] })
    expect(failed.isError).toBe(true)
    expect(
      await tool(cwd, "search_items", { registries: ["@nowhere"] })
    ).toEqual({
      text: expect.stringContaining(
        "@nowhere is not a registry this project knows"
      ),
      isError: true,
    })
    expect(await tool(cwd, "search_items", { query: 3 })).toEqual({
      text: "query is a string",
      isError: true,
    })
    expect(await tool(cwd, "search_items", { registries: [1] })).toEqual({
      text: "registries is a list of strings",
      isError: true,
    })
  })

  it("views items, and says which could not be read", async () => {
    const cwd = project(root, kirana)
    const viewed = await tool(cwd, "view_items", {
      items: ["@acme/button", "note"],
    })
    expect(viewed.isError).toBe(false)
    expect(viewed.text).toContain("@acme/button 1.2.0 · component")
    expect(viewed.text).toContain("react/base  ui/button.tsx")
    const mixed = await tool(cwd, "view_items", {
      items: ["@acme/button", "@acme/index"],
    })
    expect(mixed.isError).toBe(false)
    expect(mixed.text).toMatch(/\n@acme\/index: is an index/)
    const failed = await tool(cwd, "view_items", { items: ["Bad Name"] })
    expect(failed).toEqual({
      text: "Bad Name: is not an item: @namespace/name, or a name for @kirana's\n",
      isError: true,
    })
    expect(await tool(cwd, "view_items", { items: [] })).toEqual({
      text: "items is a list of strings, not empty",
      isError: true,
    })
    expect((await tool(cwd, "view_items")).isError).toBe(true)
  })

  it("gives an item's files with their content, for the framework and base asked for", async () => {
    const cwd = project(root, kirana)
    type Files = {
      name: string
      version: string
      files: { group: string; installsAt: string; content: string }[]
    }
    const files = async (args: Record<string, unknown>) =>
      JSON.parse((await tool(cwd, "get_item_files", args)).text) as Files
    const every = await files({ item: "@acme/button" })
    expect(every).toMatchObject({ name: "button", version: "1.2.0" })
    expect(
      every.files.map((file) => `${file.group} ${file.installsAt}`)
    ).toEqual([
      "styles ui/button.styles.ts",
      "files lib/utils.ts",
      "files app/globals.css",
      "react/base ui/button.tsx",
      "react/aria ui/button.tsx",
      "vue/ark ui/button/Button.vue",
      "vue/ark ui/button/index.ts",
    ])
    expect(every.files[3]!.content).toBe("base")
    const aria = await files({
      item: "@acme/button",
      framework: "react",
      base: "aria",
    })
    expect(aria.files.map((file) => file.group)).toEqual([
      "styles",
      "files",
      "files",
      "react/aria",
    ])
    // The project's framework, from its package.json.
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({ dependencies: { vue: "^3" } })
    )
    expect((await files({ item: "@acme/button" })).files.at(-1)!.group).toBe(
      "vue/ark"
    )
    // An item with no markup has its files whatever the framework.
    expect((await files({ item: "@acme/note" })).files).toHaveLength(1)
    expect(
      (await files({ item: "card" })).files.map((file) => file.group)
    ).toEqual(["styles"])
    expect(
      await tool(cwd, "get_item_files", {
        item: "@acme/button",
        framework: "solid",
      })
    ).toEqual({
      text: "@acme/button has no solid markup: it has react, vue",
      isError: true,
    })
    expect(
      await tool(cwd, "get_item_files", {
        item: "@acme/button",
        framework: "react",
        base: "ng",
      })
    ).toEqual({
      text: "@acme/button has no react base ng: it has base, aria",
      isError: true,
    })
    expect(await tool(cwd, "get_item_files", { item: "" })).toEqual({
      text: "item is a string",
      isError: true,
    })
  })

  it("gives the add command for the project's package manager", async () => {
    const cwd = project(root, kirana)
    expect(
      await tool(cwd, "get_add_command", { items: ["@acme/button", "note"] })
    ).toEqual({
      text: "npx kirana-style ui add @acme/button note",
      isError: false,
    })
    writeFileSync(path.join(cwd, "bun.lock"), "")
    expect((await tool(cwd, "get_add_command", { items: ["note"] })).text).toBe(
      "bunx kirana-style ui add note"
    )
    expect(
      await tool(cwd, "get_add_command", { items: ["note", "Bad Name", "x/y"] })
    ).toEqual({
      text: "Bad Name, x/y: not an item (@namespace/name, or a name for @kirana's)",
      isError: true,
    })
  })

  it("says when the project's settings cannot be read", async () => {
    const broken = mkdtempSync(path.join(root, "broken-"))
    writeFileSync(
      path.join(broken, "kirana.config.json"),
      JSON.stringify({ ui: { registries: 3 } })
    )
    const answer = await tool(broken, "list_registries")
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain("ui/registries")
  })

  it("has a fixture with markup on two frameworks", () => {
    expect(Object.keys(BUTTON.frameworks!)).toEqual(["react", "vue"])
  })
})
