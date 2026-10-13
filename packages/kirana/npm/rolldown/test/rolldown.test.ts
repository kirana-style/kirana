import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { rolldown } from "rolldown"
import type { OutputAsset, OutputChunk } from "rolldown"
import { afterAll, describe, expect, it } from "vitest"

import kirana, { createKirana } from "../src/index.ts"

const created: string[] = []
function app(): string {
  const directory = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  cpSync(path.join(import.meta.dirname, "app"), directory, { recursive: true })
  created.push(directory)
  return directory
}
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

async function bundle(root: string, fileName?: string) {
  const build = await rolldown({
    input: path.join(root, "src/main.ts"),
    cwd: root,
    logLevel: "silent",
    plugins: [kirana({ root, fileName })],
  })
  return (await build.generate({ dir: "dist" })).output
}

describe("KRN-INT-002 Rolldown on its own", () => {
  it("compiles modules and emits the stylesheet it names", async () => {
    const output = await bundle(app())
    const js = output.find((file) => file.type === "chunk") as OutputChunk
    const css = output.find(
      (file) => file.fileName === "kirana.css"
    ) as OutputAsset
    expect(js.code).toContain("k5O_")
    expect(js.code).not.toContain('@kirana-style/core"')
    expect(String(css.source)).toContain("@layer kirana")
    expect(String(css.source)).toContain("display:grid")
    expect(String(css.source)).not.toContain("kirana-placeholder")
  })

  it("writes the stylesheet under a chosen name, which the import yields", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import href from "@kirana-style/core/stylesheet.css"\nexport { href }\n'
    )
    const output = await bundle(root, "styles/app.css")
    const js = output.find((file) => file.type === "chunk") as OutputChunk
    expect(js.code).toContain('"styles/app.css"')
    expect(output.some((file) => file.fileName === "styles/app.css")).toBe(true)
  })

  it("fails the build on error diagnostics", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import { css } from "@kirana-style/core"\nexport const bad = css({ colour: "red" })\n'
    )
    await expect(bundle(root)).rejects.toThrow("unknown-property")
  })

  it("forwards watch changes to the Driver and defaults the root", async () => {
    const { plugin, session, state } = createKirana()
    expect(state.root).toBe(process.cwd())
    const driver = await session()
    const invalidate = driver.invalidate.bind(driver)
    const seen: string[] = []
    driver.invalidate = (file) => (seen.push(file), invalidate(file))
    await plugin.watchChange("/project/src/tokens.ts")
    expect(seen).toEqual(["/project/src/tokens.ts"])
  })
})

describe("components and the stylesheet asset, hook by hook", () => {
  type Hook = (this: unknown, ...args: unknown[]) => Promise<unknown>
  const context = {
    addWatchFile: () => {},
    warn: () => {},
    error: (message: string) => {
      throw new Error(message)
    },
    emitFile: () => "",
  }

  it("compiles a component as it is read", async () => {
    const root = app()
    const changed: string[] = []
    const { plugin } = createKirana(
      { root, driver: { importModule: (url) => import(url) } },
      { cssChanged: () => changed.push("css") }
    )
    const load = (plugin.load.handler as Hook).bind(context)
    const card = path.join(root, "src/Card.svelte")
    writeFileSync(
      card,
      '<script>\nimport { css } from "@kirana-style/core"\nimport { space } from "./tokens.ts"\nconst card = css({ display: "grid", gap: space[4] })\n</script>\n<p sx={card}>t</p>\n'
    )
    const compiled = (await load(card)) as { code: string; map: string }
    expect(compiled.code).toContain("__kirana_attrs([card]")
    expect(compiled.map).toContain("Card.svelte")
    expect(changed).toEqual(["css"])
    const plain = path.join(root, "src/Plain.svelte")
    writeFileSync(plain, "<p>t</p>\n")
    expect(await load(plain)).toBeNull()
    expect(await load("/app/node_modules/lib/Card.vue")).toBeNull()
    const transform = (plugin.transform.handler as Hook).bind(context)
    expect(
      await transform(
        'import { css } from "@kirana-style/core"',
        "/app/node_modules/lib/a.js"
      )
    ).toBeNull()
    expect(changed).toEqual(["css"])
  })

  it("fills the stylesheet in place when something else renames it", async () => {
    const { plugin, filled } = createKirana(
      { root: app() },
      { bundlesCss: true, renames: false }
    )
    const assets: Record<
      string,
      { type: string; fileName: string; source?: string }
    > = {
      "index.abcdefgh.css": {
        type: "asset",
        fileName: "_astro/index.abcdefgh.css",
        source: '.kirana-placeholder{--kirana:"stylesheet"}',
      },
    }
    await (plugin.generateBundle.handler as Hook).call(context, {}, assets)
    expect(assets["index.abcdefgh.css"]!.source).toContain("@layer kirana")
    expect([...filled]).toEqual(["_astro/index.abcdefgh.css"])
  })

  it("renames the filled stylesheet everywhere it is named", async () => {
    const { plugin } = createKirana({ root: app() }, { bundlesCss: true })
    const emitted: { fileName: string }[] = []
    const other = new Set(["other.css"])
    const imported = new Set(["assets/index-AbC12345.css"])
    const assets: Record<string, Record<string, unknown>> = {
      css: {
        type: "asset",
        fileName: "assets/index-AbC12345.css",
        source: '.kirana-placeholder{--kirana:"stylesheet"}',
      },
      manifest: {
        type: "asset",
        fileName: "manifest.json",
        source: '["index-AbC12345.css"]',
      },
      binary: { type: "asset", fileName: "a.png", source: new Uint8Array([1]) },
      main: {
        type: "chunk",
        code: "",
        viteMetadata: { importedCss: imported },
      },
      side: { type: "chunk", code: "", viteMetadata: { importedCss: other } },
      bare: { type: "chunk", code: "" },
    }
    await (plugin.generateBundle.handler as Hook).call(
      {
        ...context,
        emitFile: (file: { fileName: string }) => emitted.push(file),
      },
      {},
      assets
    )
    const name = emitted[0]!.fileName
    expect(name).toMatch(/^assets\/index-[\w-]{8}\.css$/)
    expect(assets.manifest!.source).toBe(`["${path.posix.basename(name)}"]`)
    expect([...imported]).toEqual([name])
    expect([...other]).toEqual(["other.css"])
  })
})
