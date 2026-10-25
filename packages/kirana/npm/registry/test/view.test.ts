import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test"

import { check } from "../src/check.ts"
import { BUTTON, NOTE, project, runIn } from "./fixtures.ts"
import { CARD, serve } from "./server.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-view-"))
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

describe("KRN-DX-027 kirana-style ui view", () => {
  it("has fixtures the schema accepts", () => {
    expect(check(BUTTON).problems).toEqual([])
    expect(check(NOTE).problems).toEqual([])
  })

  it("shows what an item is and what it installs, never a file's content", async () => {
    const cwd = project(root, kirana)
    const url = pathToFileURL(path.join(cwd, "acme/button.json")).href
    expect(await runIn(cwd, {}, "view", "@acme/button")).toEqual({
      code: 0,
      text: [
        "@acme/button 1.2.0 · component",
        "Button: Displays a button.",
        `from ${url}`,
        "",
        "  kirana      ^0.3.2",
        "  registry    @acme/spinner, separator",
        "  packages    @kirana-style/core ^0.3.2",
        "  axes        style, radius",
        "  styles      ui/button.styles.ts",
        "  react/base  ui/button.tsx · @base-ui/react ^1.0.0",
        "  react/aria  ui/button.tsx",
        "  vue/ark     ui/button/Button.vue, ui/button/index.ts",
        "  files       lib/utils.ts, app/globals.css",
        "",
      ].join("\n"),
    })
  })

  it("shows several items, @kirana's by name, each with the fields it has", async () => {
    const cwd = project(root, kirana)
    const { code, text } = await runIn(cwd, {}, "view", "@acme/note", "card")
    expect(code).toBe(0)
    expect(text).toBe(
      [
        "@acme/note 0.1.0 · lib",
        "A note.",
        `from ${pathToFileURL(path.join(cwd, "acme/note.json")).href}`,
        "",
        "  files  lib/note.ts",
        "",
        "card 0.1.0 · component",
        `from ${registry.url}/r/card.json`,
        "",
        "  styles  ui/card.styles.ts",
        "",
      ].join("\n")
    )
  })

  it("prints the items as read, and the failures, with --json", async () => {
    const cwd = project(root, kirana)
    const { code, text } = await runIn(
      cwd,
      {},
      "view",
      "--json",
      "@acme/button",
      "card"
    )
    expect(code).toBe(0)
    expect(JSON.parse(text)).toEqual({ items: [BUTTON, CARD], failures: [] })
  })

  it("names each item it cannot read and why, shows the others, and exits 1", async () => {
    const cwd = project(root, kirana)
    const { code, text } = await runIn(
      cwd,
      {},
      "view",
      "missing",
      "@acme/index",
      "../button",
      "@nope/button",
      "@acme/note"
    )
    expect(code).toBe(1)
    const lines = text.trimEnd().split("\n")
    expect(lines.slice(0, 2)).toEqual(["@acme/note 0.1.0 · lib", "A note."])
    expect(lines.slice(-4)).toEqual([
      `missing: ${registry.url}/r/missing.json: answered 404 Not Found`,
      "@acme/index: is an index: kirana-style ui search lists its items",
      "../button: is not an item: @namespace/name, or a name for @kirana's",
      "@nope/button: @nope is not a registry this project knows: @kirana, @acme (ui.registries in kirana.config)",
    ])
    const json = await runIn(cwd, {}, "view", "missing", "--json")
    expect(json.code).toBe(1)
    expect(JSON.parse(json.text)).toEqual({
      items: [],
      failures: [
        {
          document: "missing",
          message: `${registry.url}/r/missing.json: answered 404 Not Found`,
        },
      ],
    })
  })

  it("needs an item and knows its options; settings it cannot use stop it", async () => {
    const cwd = project(root, kirana)
    expect(await runIn(cwd, {}, "view")).toEqual({
      code: 2,
      text: "kirana-style ui view needs at least one item\n",
    })
    expect(await runIn(cwd, {}, "view", "--yaml", "button")).toEqual({
      code: 2,
      text: "kirana-style ui view: unknown option --yaml\n",
    })
    writeFileSync(
      path.join(cwd, "kirana.config.json"),
      '{"ui":{"registries":{"acme":"x"}}}'
    )
    const broken = await runIn(cwd, {}, "view", "button")
    expect(broken.code).toBe(2)
    expect(broken.text).toMatch(/ui\/registries\/acme is not allowed here\n$/)
  })
})
