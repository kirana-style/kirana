import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test"

import { check } from "../src/check.ts"
import { matches } from "../src/index.ts"
import { ACME_INDEX, project, runIn } from "./fixtures.ts"
import { serve } from "./server.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-search-"))
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

describe("KRN-DX-027 kirana-style ui search", () => {
  it("matches every word of the query in a name, title or description, ignoring case", () => {
    const [button, note, login] = ACME_INDEX.items
    expect(check(ACME_INDEX).problems).toEqual([])
    expect(matches(button!, ["button"])).toBe(true)
    expect(matches(login!, ["login", "form"])).toBe(true)
    expect(matches(login!, ["login", "button"])).toBe(false)
    expect(matches(note!, [])).toBe(true)
  })

  it("lists every entry of every registry without a query, in aligned columns", async () => {
    const cwd = project(root, kirana)
    const { code, text } = await runIn(cwd, {}, "search")
    expect(code).toBe(0)
    expect(text.trimEnd().split("\n")).toEqual([
      "@kirana/card    0.1.0   component",
      "@acme/button    1.2.0   component  Button  react base, aria · vue ark",
      "@acme/note      0.1.0   lib",
      "@acme/login-01  0.10.0  block      Login   react base",
    ])
  })

  it("narrows to a query, or to the registries named with --registry", async () => {
    const cwd = project(root, kirana)
    expect(await runIn(cwd, {}, "search", "LOGIN", "form")).toEqual({
      code: 0,
      text: "@acme/login-01  0.10.0  block  Login  react base\n",
    })
    const acme = await runIn(cwd, {}, "search", "--registry", "@acme")
    expect(acme.text.trimEnd().split("\n")).toHaveLength(3)
    expect(
      await runIn(cwd, {}, "search", "card", "--registry", "@acme")
    ).toEqual({ code: 0, text: 'nothing in @acme matches "card"\n' })
  })

  it("prints the results with where they are, and the failures, with --json", async () => {
    const cwd = project(root, kirana)
    const { code, text } = await runIn(cwd, {}, "search", "note", "--json")
    expect(code).toBe(0)
    expect(JSON.parse(text)).toEqual({
      results: [
        {
          name: "note",
          type: "lib",
          version: "0.1.0",
          description: "A note.",
          reference: "@acme/note",
          namespace: "@acme",
        },
      ],
      failures: [],
    })
  })

  it("says a registry lists nothing", async () => {
    const cwd = project(root, kirana, {}, { index: { items: [] } })
    expect(await runIn(cwd, {}, "search", "--registry", "@acme")).toEqual({
      code: 0,
      text: "no items in @acme\n",
    })
  })

  it("names an index it cannot read and why, lists the others, and exits 1", async () => {
    const cwd = project(root, kirana, {
      "@gone": `${registry.url}/gone/{name}.json`,
    })
    const { code, text } = await runIn(cwd, {}, "search", "button")
    expect(code).toBe(1)
    expect(text).toBe(
      [
        "@acme/button  1.2.0  component  Button  react base, aria · vue ark",
        `@gone/index: ${registry.url}/gone/index.json: answered 404 Not Found`,
        "",
      ].join("\n")
    )
    const only = await runIn(cwd, {}, "search", "--registry", "@gone")
    expect(only).toEqual({
      code: 1,
      text: `@gone/index: ${registry.url}/gone/index.json: answered 404 Not Found\n`,
    })
    const json = await runIn(cwd, {}, "search", "--registry", "@gone", "--json")
    expect(JSON.parse(json.text)).toEqual({
      results: [],
      failures: [
        {
          document: "@gone/index",
          message: `${registry.url}/gone/index.json: answered 404 Not Found`,
        },
      ],
    })
  })

  it("stops on an unknown option or registry, a missing value, or settings it cannot use", async () => {
    const cwd = project(root, kirana)
    expect(await runIn(cwd, {}, "search", "--all")).toEqual({
      code: 2,
      text: "kirana-style ui search: unknown option --all\n",
    })
    expect(await runIn(cwd, {}, "search", "--registry")).toEqual({
      code: 2,
      text: "kirana-style ui search: --registry needs a value\n",
    })
    expect(
      await runIn(cwd, {}, "search", "--registry", "--json")
    ).toMatchObject({ code: 2 })
    expect(await runIn(cwd, {}, "search", "--registry", "@nope")).toEqual({
      code: 2,
      text: "@nope is not a registry this project knows: @kirana, @acme (ui.registries in kirana.config)\n",
    })
    writeFileSync(
      path.join(cwd, "kirana.config.json"),
      '{"ui":{"registries":5}}'
    )
    const broken = await runIn(cwd, {}, "search")
    expect(broken.code).toBe(2)
    expect(broken.text).toMatch(/ui\/registries must be an object\n$/)
  })
})
