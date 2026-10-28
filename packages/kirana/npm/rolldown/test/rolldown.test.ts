import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { rolldown } from "rolldown"
import type { OutputAsset, OutputChunk } from "rolldown"
import { Driver } from "@kirana-style/compiler"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"

import kirana, { createKirana } from "../src/index.ts"
import type { KiranaRolldownOptions } from "../src/index.ts"

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

async function bundle(
  root: string,
  fileName?: string,
  names?: KiranaRolldownOptions["names"],
  sourcemap = true
) {
  const build = await rolldown({
    input: path.join(root, "src/main.ts"),
    cwd: root,
    logLevel: "silent",
    plugins: [kirana({ root, fileName, names })],
  })
  return (await build.generate({ dir: "dist", sourcemap })).output
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

  it("drops a recipe table whose every call resolved at build time", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/main.ts"),
      [
        'import { css, recipe } from "@kirana-style/core"',
        "const button = recipe({",
        '  base: css({ display: "flex" }),',
        '  variants: { tone: { solid: css({ color: "red" }), ghost: css({ color: "blue" }) } },',
        "})",
        'export const solid = button({ tone: "solid" })',
        "",
      ].join("\n")
    )
    const output = await bundle(root)
    const js = output.find((file) => file.type === "chunk") as OutputChunk
    const css = output.find(
      (file) => file.fileName === "kirana.css"
    ) as OutputAsset
    const ghost = /\.(k50_\w+)\{color:blue\}/.exec(String(css.source))?.[1]
    expect(ghost).toBeDefined()
    expect(js.code).toContain("k5O_")
    expect(js.code).not.toContain(ghost)
    expect(js.code).not.toContain("recipe")
    expect(js.code).not.toContain("runtime")
  })

  it("gives a production build dense names, the same in its chunks and its stylesheet (D-084)", async () => {
    const source = [
      'import "@kirana-style/core/stylesheet.css"',
      'import { css, cx, recipe } from "@kirana-style/core"',
      "const box = css({",
      '  display: "grid",',
      '  color: { base: "red", ":hover": "blue", "@media (width >= 48rem)": "green" },',
      '  padding: "1rem",',
      "})",
      "const tone = recipe({",
      '  base: css({ borderStyle: "solid" }),',
      '  variants: { tone: { a: css({ color: { ":hover": "red" } }), b: css({ color: "blue" }) } },',
      "})",
      "export const pick = (name: 'a' | 'b') => tone({ tone: name })",
      // A chunk of its own with no class names in it.
      'export const later = () => import("./plain.ts")',
      "export const merged = (wide: boolean) => cx(box, wide && css({ paddingTop: 0, color: { ':hover': null } }))",
      "",
    ].join("\n")
    const build = async (
      names: KiranaRolldownOptions["names"],
      sourcemap = true
    ) => {
      const root = app()
      writeFileSync(path.join(root, "src/main.ts"), source)
      writeFileSync(path.join(root, "src/plain.ts"), "export const plain = 1\n")
      const output = await bundle(root, undefined, names, sourcemap)
      const chunks = output.filter((file) => file.type === "chunk")
      expect(chunks).toHaveLength(2)
      const js = chunks.find((chunk) => chunk.isEntry) as OutputChunk
      const css = output.find(
        (file) => file.fileName === "kirana.css"
      ) as OutputAsset
      return { js, css: String(css.source) }
    }
    const hashed = await build("hashed")
    const dense = await build("dense")
    const hash =
      /\bk[0-9A-Za-z]+(?:-[0-9A-Za-z]{3})?-[0-9A-Za-z]{4}_|_[0-9A-Za-z]{4}\b/
    expect(hashed.css).toMatch(hash)
    expect(dense.css).not.toMatch(hash)
    expect(dense.js.code).not.toMatch(hash)
    expect(dense.css.length).toBeLessThan(hashed.css.length)
    // The same rules in the same order: only names changed.
    const rules = (css: string) => css.replace(/\.k[^{,:]*/g, ".k")
    expect(rules(dense.css)).toBe(rules(hashed.css))
    // Every atom a chunk names has its rule.
    const atoms = [
      ...dense.js.code.matchAll(
        /\bk[0-9A-Za-z]+(?:-[0-9A-Za-z]{1,3})*_[0-9A-Za-z]{1,2}\b/g
      ),
    ]
    expect(atoms.length).toBeGreaterThan(5)
    for (const [atom] of atoms) expect(dense.css).toContain("." + atom)
    // The renaming is in the chunk's source map.
    expect(dense.js.map?.sources.some((file) => file.endsWith("main.ts"))).toBe(
      true
    )
    // A build that writes no maps gets the same names, and the renaming builds none (KF-061).
    const renaming = vi.spyOn(Driver.prototype, "dense")
    const unmapped = await build("dense", false)
    // One call per chunk, each asking for no map.
    expect(renaming.mock.calls.map((call) => call[2])).toEqual([false, false])
    renaming.mockRestore()
    expect(unmapped.js.code).toBe(
      dense.js.code.replace(/\n\/\/# sourceMappingURL=.*$/, "")
    )
    expect(unmapped.js.map).toBeNull()
  })

  it("writes the variable tokens the bundle uses, and runtime ones (D-086)", async () => {
    const tokens = [
      'import { defineTokens } from "@kirana-style/core"',
      'export const size = defineTokens("size", { read: "2px", unused: "4px" }, { variable: true })',
      'export const glow = defineTokens("glow", { soft: "1px" }, { runtime: true })',
      "",
    ].join("\n")
    const build = async (main: string) => {
      const root = app()
      writeFileSync(path.join(root, "src/tokens.ts"), tokens)
      writeFileSync(path.join(root, "src/main.ts"), main)
      const output = await bundle(root)
      const js = output.find((file) => file.type === "chunk") as OutputChunk
      const css = String(
        (output.find((file) => file.fileName === "kirana.css") as OutputAsset)
          .source
      )
      return { js: js.code, css }
    }
    const declared = (css: string) =>
      [...css.matchAll(/(--kv[0-9A-Za-z]{4}):/g)].map(([, name]) => name)

    // Compiled code reads one token at build time; nothing reads the group at runtime.
    const compiled = await build(
      'import "@kirana-style/core/stylesheet.css"\nimport { css } from "@kirana-style/core"\nimport { size } from "./tokens.ts"\nexport const box = css({ gap: size.read })\n'
    )
    expect(compiled.css).toContain("gap:var(--kv")
    // `size.read`, which a rule reads, and the runtime `glow.soft`; not `size.unused`.
    expect(declared(compiled.css)).toHaveLength(2)

    // A plain module reads the group at runtime: the bundle keeps its tokens, and so does the CSS.
    const runtime = await build(
      'import "@kirana-style/core/stylesheet.css"\nimport { size } from "./tokens.ts"\ndocument.body.style.gap = size.unused\n'
    )
    expect(runtime.js).toMatch(/--kv[0-9A-Za-z]{4}/)
    expect(declared(runtime.css)).toHaveLength(3)
  })

  it("keeps a token another file of the bundle names (D-086)", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/tokens.ts"),
      'import { defineTokens } from "@kirana-style/core"\nexport const size = defineTokens("size", { other: "6px" }, { variable: true })\n'
    )
    // The token's name, from a build that reads it at runtime.
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import "@kirana-style/core/stylesheet.css"\nimport { size } from "./tokens.ts"\ndocument.body.style.gap = size.other\n'
    )
    const [variable] = (await bundle(root))
      .filter((file) => file.type === "chunk")
      .flatMap(
        (chunk) =>
          (chunk as OutputChunk).code.match(/--kv[0-9A-Za-z]{4}/g) ?? []
      )
    expect(variable).toBeDefined()
    // Now no chunk reads it, but a stylesheet another plugin adds to the bundle does.
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import "@kirana-style/core/stylesheet.css"\nimport "./tokens.ts"\n'
    )
    const other = {
      name: "other-stylesheet",
      renderStart(this: { emitFile: (file: object) => string }) {
        this.emitFile({
          type: "asset",
          fileName: "other.css",
          source: `.x{gap:var(${variable})}`,
        })
      },
    }
    const built = await rolldown({
      input: path.join(root, "src/main.ts"),
      cwd: root,
      logLevel: "silent",
      plugins: [kirana({ root }), other],
    })
    const { output } = await built.generate({ dir: "dist" })
    const css = String(
      (output.find((file) => file.fileName === "kirana.css") as OutputAsset)
        .source
    )
    expect(css).toContain(`${variable}:6px`)
  })

  it("fails a later build that reads a token the stylesheet left out (D-086)", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/tokens.ts"),
      'import { defineTokens } from "@kirana-style/core"\nexport const size = defineTokens("size", { unused: "4px" }, { variable: true })\n'
    )
    writeFileSync(
      path.join(root, "src/main.ts"),
      // Compiled, but nothing reads it at runtime: the bundler drops its token object.
      'import "@kirana-style/core/stylesheet.css"\nimport "./tokens.ts"\n'
    )
    writeFileSync(
      path.join(root, "src/server.ts"),
      'import { size } from "./tokens.ts"\nexport const render = () => `<p style="gap:${size.unused}"></p>`\n'
    )
    // One plugin for both builds, as Vite shares it between the client and the server.
    const plugin = kirana({ root })
    const run = async (input: string) => {
      const built = await rolldown({
        input: path.join(root, input),
        cwd: root,
        logLevel: "silent",
        plugins: [plugin],
      })
      return built.generate({ dir: "dist" })
    }
    const client = await run("src/main.ts")
    const css = String(
      (
        client.output.find(
          (file) => file.fileName === "kirana.css"
        ) as OutputAsset
      ).source
    )
    expect(css).not.toMatch(/--kv[0-9A-Za-z]{4}:4px/)
    await expect(run("src/server.ts")).rejects.toThrow(
      /size\.unused \(--kv[0-9A-Za-z]{4}\).*runtime: true/
    )
  })

  it("writes the keyframes the bundle uses, not a library's other animations (D-094)", async () => {
    const motion = [
      'import { defineTokens, keyframes } from "@kirana-style/core"',
      'export const space = defineTokens("space", { 1: "4px" })',
      "export const fade = keyframes({ to: { opacity: 0 } })",
      'export const spin = keyframes({ to: { rotate: "1turn" } })',
      "",
    ].join("\n")
    const build = async (main: string) => {
      const root = app()
      writeFileSync(path.join(root, "src/motion.ts"), motion)
      writeFileSync(path.join(root, "src/main.ts"), main)
      const output = await bundle(root)
      return String(
        (output.find((file) => file.fileName === "kirana.css") as OutputAsset)
          .source
      )
    }
    const declared = (css: string) =>
      css.match(/@keyframes kf[0-9A-Za-z]{4}/g) ?? []

    // A scale from the module, and none of its animations: no keyframes ship.
    const scaleOnly = await build(
      'import "@kirana-style/core/stylesheet.css"\nimport { css } from "@kirana-style/core"\nimport { space } from "./motion.ts"\nexport const box = css({ gap: space[1] })\n'
    )
    expect(declared(scaleOnly)).toHaveLength(0)

    // A rule reads one, and code names the other at runtime: both ship.
    const used = await build(
      'import "@kirana-style/core/stylesheet.css"\nimport { css } from "@kirana-style/core"\nimport { fade, spin } from "./motion.ts"\nexport const box = css({ animationName: fade })\ndocument.body.style.animationName = spin\n'
    )
    expect(declared(used)).toHaveLength(2)
  })

  it("fails a later build that names keyframes the stylesheet left out (D-094)", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/motion.ts"),
      'import { keyframes } from "@kirana-style/core"\nexport const spin = keyframes({ to: { rotate: "1turn" } })\n'
    )
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import "@kirana-style/core/stylesheet.css"\nimport "./motion.ts"\n'
    )
    writeFileSync(
      path.join(root, "src/server.ts"),
      'import { spin } from "./motion.ts"\nexport const render = () => `<p style="animation-name:${spin}"></p>`\n'
    )
    const plugin = kirana({ root })
    const run = async (input: string) => {
      const built = await rolldown({
        input: path.join(root, input),
        cwd: root,
        logLevel: "silent",
        plugins: [plugin],
      })
      return built.generate({ dir: "dist" })
    }
    const client = await run("src/main.ts")
    const css = String(
      (
        client.output.find(
          (file) => file.fileName === "kirana.css"
        ) as OutputAsset
      ).source
    )
    expect(css).not.toContain("@keyframes")
    await expect(run("src/server.ts")).rejects.toThrow(
      /names keyframes the stylesheet left out: kf[0-9A-Za-z]{4}.*animationName/
    )
  })

  it("refuses dense names with a class map", async () => {
    const root = app()
    const build = rolldown({
      input: path.join(root, "src/main.ts"),
      cwd: root,
      logLevel: "silent",
      plugins: [
        kirana({
          root,
          names: "dense",
          config: {
            classes: { modules: ["src/tokens.ts"], out: "classes.json" },
          },
        }),
      ],
    })
    await expect(
      build.then((built) => built.generate({ dir: "dist" }))
    ).rejects.toThrow("cannot be used with a class map")
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

  it("leaves chunks alone while a dev server runs", async () => {
    const { plugin } = createKirana(
      { root: app() },
      { development: () => true }
    )
    expect(
      await (plugin.renderChunk as Hook).call(context, "x", {
        fileName: "a.js",
      })
    ).toBeNull()
  })

  it("compiles each module once in a one-shot build, every time in a watch build", async () => {
    for (const [watchMode, expected] of [
      [false, 1],
      [true, 0],
    ] as const) {
      const { plugin, session } = createKirana({ root: app() })
      const driver = await session()
      let reused = 0
      driver.reuseTransforms = () => void reused++
      await (plugin.buildStart as Hook).call({
        ...context,
        meta: { watchMode },
      })
      expect(reused).toBe(expected)
    }
  })

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
