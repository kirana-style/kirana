import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, describe, expect, it } from "vitest"

import kirana, { renameStylesheets } from "../src/index.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

function output(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "kirana-astro-"))
  created.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

describe("KRN-INT-004 Astro integration", () => {
  it("renames a filled stylesheet by its content and rewrites every reference", async () => {
    const dir = output({
      "client/_astro/index.DslQtQbq.css": "@layer kirana{.a{color:red}}",
      "client/index.html": '<link href="/_astro/index.DslQtQbq.css">',
      "server/manifest.mjs": 'export const css = ["index.DslQtQbq.css"]',
      "client/other.css": ".b{}",
      "client/logo.png": "index.DslQtQbq.css",
    })
    const renames = await renameStylesheets(dir, ["_astro/index.DslQtQbq.css"])
    const next = renames.get("index.DslQtQbq.css")!
    expect(next).toMatch(/^index-[\w-]{8}\.css$/)
    expect(existsSync(path.join(dir, "client/_astro", next))).toBe(true)
    expect(readFileSync(path.join(dir, "client/index.html"), "utf8")).toContain(
      next
    )
    expect(
      readFileSync(path.join(dir, "server/manifest.mjs"), "utf8")
    ).toContain(next)
    expect(readFileSync(path.join(dir, "client/other.css"), "utf8")).toBe(
      ".b{}"
    )
    expect(readFileSync(path.join(dir, "client/logo.png"), "utf8")).toBe(
      "index.DslQtQbq.css"
    )
    // A second pass finds the name already right, and an inlined stylesheet has no file at all.
    expect((await renameStylesheets(dir, [`_astro/${next}`])).size).toBe(0)
    expect((await renameStylesheets(dir, ["_astro/gone.css"])).size).toBe(0)
  })

  it("adds the Vite plugin, then renames after the build", async () => {
    const dir = output({
      "_astro/index.DslQtQbq.css": "x",
      "index.html": "/_astro/index.DslQtQbq.css",
    })
    const integration = kirana({ reportInfo: true })
    expect(integration.name).toBe("@kirana-style/astro")
    let plugins: { name: string; api: { filled: Set<string> } }[] = []
    integration.hooks["astro:config:setup"]({
      updateConfig: (config) => {
        plugins = config.vite.plugins as typeof plugins
      },
    })
    expect(plugins.map((plugin) => plugin.name)).toEqual([
      "kirana",
      "kirana:late",
    ])
    integration.hooks["astro:config:done"]({
      config: { outDir: pathToFileURL(`${dir}/`) },
    })
    plugins[0]!.api.filled.add("_astro/index.DslQtQbq.css")
    await integration.hooks["astro:build:done"]()
    expect(readFileSync(path.join(dir, "index.html"), "utf8")).toMatch(
      /\/_astro\/index-[\w-]{8}\.css/
    )
    expect(kirana().name).toBe("@kirana-style/astro")
  })
})
