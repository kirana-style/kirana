import { EventEmitter } from "node:events"
import { createRequire } from "node:module"
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"
import { build, createServer } from "vite"
import type { Rolldown } from "vite"

import kirana, {
  PLACEHOLDER,
  cleanId,
  cssLayer,
  wrapInLayer,
  readSource,
  renameAsset,
} from "../src/index.ts"

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

describe("helpers", () => {
  it("cleans ids and renames assets by content", () => {
    expect(cleanId("/a/b.css?direct&t=1")).toBe("/a/b.css")
    expect(renameAsset("assets/index-AbC12345.css", "x")).toMatch(
      /^assets\/index-[\w-]{8}\.css$/
    )
    expect(renameAsset("main.css", "x")).toMatch(/^main-[\w-]{8}\.css$/)
    expect(renameAsset("a.css", "x")).toBe(renameAsset("a.css", "x"))
  })

  it("reads a diagnostic's source relative to the root, or nothing", () => {
    expect(readSource(import.meta.dirname, "app/index.html")).toContain("<")
    expect(readSource(import.meta.dirname, "missing.tsx")).toBeUndefined()
  })
})

describe("cssLayer", () => {
  it("wraps a stylesheet in the layer, keeping @charset and @import first", () => {
    expect(wrapInLayer("* { padding: 0 }", "vendor")).toBe(
      "@layer vendor {\n* { padding: 0 }\n}\n"
    )
    expect(
      wrapInLayer(
        '@charset "utf-8";\n@import "./a.css";\n@import "./b.css" layer(own);\np { margin: 0 }',
        "vendor"
      )
    ).toBe(
      '@charset "utf-8";\n@import "./a.css" layer(vendor);\n@import "./b.css" layer(own);\n@layer vendor {\np { margin: 0 }\n}\n'
    )

    // A comment among the leading statements stays with them; an unclosed one, or an import
    // without its semicolon, ends them, and the rest is wrapped as it is.
    expect(wrapInLayer('/* © */\n@import "./a.css";\na {}', "v")).toBe(
      '/* © */\n@import "./a.css" layer(v);\n@layer v {\na {}\n}\n'
    )
    expect(wrapInLayer("/* open\na {}", "v")).toBe(
      "@layer v {\n/* open\na {}\n}\n"
    )
    expect(wrapInLayer('@import "./a.css"', "v")).toBe(
      '@layer v {\n@import "./a.css"\n}\n'
    )
    // Linear on what a pattern could backtrack over: a long run of spaces after the keyword.
    const spaces = `@import ${" ".repeat(200_000)}x`
    const started = performance.now()
    wrapInLayer(spaces, "v")
    expect(performance.now() - started).toBeLessThan(100)
  })

  it("wraps only the stylesheets it is given, by path or pattern", () => {
    type Handler = (code: string, id: string) => { code: string } | null
    const handler = (plugin: ReturnType<typeof cssLayer>) =>
      (plugin.transform as { handler: Handler }).handler
    const byPath = handler(cssLayer("vitepress", "vitepress/dist/client/"))
    expect(
      byPath(
        "p {}",
        "C:\\app\\node_modules\\vitepress\\dist\\client\\base.css?direct"
      )?.code
    ).toBe("@layer vitepress {\np {}\n}\n")
    expect(byPath("p {}", "/app/src/own.css")).toBeNull()
    const byPattern = handler(cssLayer("vendor", /\/carousel\//))
    expect(
      byPattern("p {}", "/app/node_modules/carousel/style.css")?.code
    ).toBe("@layer vendor {\np {}\n}\n")
    expect(cssLayer("vendor", "x").name).toBe("kirana:css-layer:vendor")
  })
})

describe("KRN-INT-009 several dev servers", () => {
  it("serves the live stylesheet while a server is open, and forgets one that closes", async () => {
    type Hook = (this: unknown, ...args: unknown[]) => unknown
    const root = app()
    const [plugin] = kirana()
    ;(plugin.configResolved as Hook)({ root })
    const stylesheet = createRequire(path.join(root, "package.json")).resolve(
      "@kirana-style/core/stylesheet.css"
    )
    const load = () =>
      (plugin.load as { handler: Hook }).handler.call({}, stylesheet)
    const httpServer = new EventEmitter()
    ;(plugin.configureServer as Hook)({ httpServer })
    expect(await load()).toContain("@layer kirana")
    httpServer.emit("close")
    expect(await load()).toBe(PLACEHOLDER)
  })
})

describe("KRN-INT-008 listed libraries", () => {
  it("keeps them out of pre-bundling and server externals", async () => {
    type ConfigHook = (config: { root?: string }) => Promise<unknown>
    const root = app()
    writeFileSync(
      path.join(root, "kirana.config.json"),
      '{"libraries":["acme-ui"]}'
    )
    expect(await (kirana()[0].config as ConfigHook)({ root })).toEqual({
      optimizeDeps: { exclude: ["@kirana-style/preset-scales", "acme-ui"] },
      ssr: { noExternal: ["@kirana-style/preset-scales", "acme-ui"] },
    })
    // Without libraries, Kirana's own preset still is one: an app that installs it compiles it.
    expect(await (kirana()[0].config as ConfigHook)({})).toEqual({
      optimizeDeps: { exclude: ["@kirana-style/preset-scales"] },
      ssr: { noExternal: ["@kirana-style/preset-scales"] },
    })
  })
})

describe("KRN-INT-002 production build", () => {
  it("compiles modules and replaces the stylesheet placeholder", async () => {
    const root = app()
    const output = (await build({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [kirana()],
      build: { write: false, minify: false, assetsInlineLimit: 0 },
    })) as Rolldown.RolldownOutput
    const css = output.output.find((file) =>
      file.fileName.endsWith(".css")
    ) as Rolldown.OutputAsset
    const js = output.output.find(
      (file) => file.type === "chunk"
    ) as Rolldown.OutputChunk
    expect(String(css.source)).toContain("@layer kirana")
    expect(String(css.source)).toContain("display:grid")
    expect(String(css.source)).not.toContain("kirana-placeholder")
    const html = output.output.find(
      (file) => file.fileName === "index.html"
    ) as Rolldown.OutputAsset
    expect(String(html.source)).toContain(css.fileName)
    expect(js.code).toContain("k5O_")
    expect(js.code).not.toContain('@kirana-style/core"')
  })

  it("gives the client and the server bundle the same dense names (D-084)", async () => {
    const root = app()
    const shared = [
      'import { css } from "@kirana-style/core"',
      'export const card = css({ display: "grid", color: { base: "red", ":hover": "blue" }, padding: "1rem" })',
      "",
    ].join("\n")
    writeFileSync(path.join(root, "src/card.ts"), shared)
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import "@kirana-style/core/stylesheet.css"\nimport { card } from "./card"\ndocument.querySelector("#app")!.className = String(card)\n'
    )
    writeFileSync(
      path.join(root, "src/server.ts"),
      'import { card } from "./card"\nexport const render = () => `<div class="${String(card)}"></div>`\n'
    )
    const plugins = kirana({ names: "dense" })
    const options = {
      root,
      logLevel: "silent" as const,
      configFile: false as const,
      plugins,
    }
    const client = (await build({
      ...options,
      build: { write: false, minify: false, assetsInlineLimit: 0 },
    })) as Rolldown.RolldownOutput
    const server = (await build({
      ...options,
      build: { write: false, minify: false, ssr: "src/server.ts" },
    })) as Rolldown.RolldownOutput
    const css = String(
      (
        client.output.find((file) =>
          file.fileName.endsWith(".css")
        ) as Rolldown.OutputAsset
      ).source
    )
    const chunk = (output: Rolldown.RolldownOutput) =>
      (
        output.output.find(
          (file) => file.type === "chunk"
        ) as Rolldown.OutputChunk
      ).code
    const atoms = (code: string) =>
      [
        ...code.matchAll(
          /\bk[0-9A-Za-z]+(?:-[0-9A-Za-z]{1,3})*_[0-9A-Za-z]{1,2}\b/g
        ),
      ].map(([atom]) => atom)
    const fromClient = atoms(chunk(client))
    const fromServer = atoms(chunk(server))
    expect(fromServer.length).toBeGreaterThan(2)
    expect(fromServer).toEqual(fromClient)
    for (const atom of fromServer) expect(css).toContain("." + atom)
    expect(css).not.toMatch(/_[0-9A-Za-z]{4}\b/)
  })

  it("fails the build on error diagnostics and warns on warnings", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import { css } from "@kirana-style/core"\nexport const bad = css({ colour: "red", padding: "var(--x)" })\n'
    )
    const warn = vi.fn()
    await expect(
      build({
        root,
        logLevel: "silent",
        configFile: false,
        customLogger: {
          info() {},
          warn,
          warnOnce() {},
          error() {},
          clearScreen() {},
          hasErrorLogged: () => false,
          hasWarned: false,
        },
        plugins: [kirana({ reportInfo: true })],
        build: { write: false },
      })
    ).rejects.toThrow("unknown-property")
  })

  it("reports project diagnostics at the end of a build", async () => {
    const root = app()
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import { css, relation } from "@kirana-style/core"\nconst field = relation("field")\nexport const label = css({ opacity: { [field.within()]: 0.5 } })\n'
    )
    await expect(
      build({
        root,
        logLevel: "silent",
        configFile: false,
        plugins: [kirana()],
        build: { write: false },
      })
    ).rejects.toThrow("relation-without-anchor")
  })
})

describe("KRN-INT-009 development server", () => {
  it("prints a module's warnings once across environments, again after an edit", async () => {
    const root = app()
    const main = path.join(root, "src/main.ts")
    const source = (colour: string) =>
      `import { css } from "@kirana-style/core"\nexport const tied = css({ color: { "[data-a]": "red", "[data-b]": "${colour}" } })\n`
    writeFileSync(main, source("blue"))
    const warn = vi.fn()
    const server = await createServer({
      root,
      configFile: false,
      customLogger: {
        info() {},
        warn,
        warnOnce() {},
        error() {},
        clearScreen() {},
        hasErrorLogged: () => false,
        hasWarned: false,
      },
      plugins: [kirana()],
      server: { middlewareMode: true, ws: false, watch: null },
    })
    const ambiguous = () =>
      warn.mock.calls.filter((call) =>
        String(call[0]).includes("ambiguous-precedence")
      ).length
    try {
      await server.environments.client.transformRequest("/src/main.ts")
      await server.environments.ssr.transformRequest("/src/main.ts")
      expect(ambiguous()).toBe(1)
      writeFileSync(main, source("green"))
      server.environments.ssr.moduleGraph.invalidateAll()
      await server.environments.ssr.transformRequest("/src/main.ts")
      expect(ambiguous()).toBe(2)
    } finally {
      await server.close()
    }
  })

  it("compiles a module a framework re-emits under a query", async () => {
    // TanStack Start's route splitting serves `route.tsx?tsr-split=component`;
    // a filter anchored on the extension would hand that chunk to the browser
    // with `css()` still in it, which then throws at runtime.
    const root = app()
    writeFileSync(
      path.join(root, "src/main.ts"),
      'import { css } from "@kirana-style/core"\nexport const box = css({ order: 3 })\n'
    )
    const server = await createServer({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [kirana()],
      server: { middlewareMode: true, ws: false, watch: null },
    })
    try {
      const split = await server.environments.client.transformRequest(
        "/src/main.ts?tsr-split=component"
      )
      expect(split?.code).not.toContain("css({")
      expect(split?.code).toContain("export const box =")
      // `?raw` and `?url` ask for the file, not for a module: left alone.
      const raw =
        await server.environments.client.transformRequest("/src/main.ts?raw")
      expect(raw?.code).toContain("css({")
    } finally {
      await server.close()
    }
  })

  it("serves the live stylesheet and updates it through HMR", async () => {
    const root = app()
    const server = await createServer({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [kirana()],
      server: { middlewareMode: true, ws: false, watch: null },
    })
    try {
      const client = server.environments.client
      const send = vi.spyOn(server.ws, "send")
      await client.transformRequest("/src/main.ts")
      await client.transformRequest("/src/plain.ts")
      const stylesheet = (await client.pluginContainer.resolveId(
        "@kirana-style/core/stylesheet.css",
        path.join(root, "src/main.ts")
      ))!.id
      const served = await client.pluginContainer.load(
        (await client.pluginContainer.resolveId(
          "@kirana-style/core/stylesheet.css",
          path.join(root, "src/main.ts")
        ))!.id
      )
      expect(
        String(typeof served === "string" ? served : served?.code)
      ).toContain("display: grid")
      await vi.waitFor(() => expect(send).toHaveBeenCalled())
      expect(JSON.stringify(send.mock.calls)).toContain("css-update")
      expect(stylesheet).toBeTruthy()

      // Once the stylesheet is a module the browser holds, an update reloads it rather than only
      // announcing it. Before that it is not in the graph, and there is nothing to reload.
      await client.transformRequest(stylesheet)
      const reload = vi
        .spyOn(client, "reloadModule")
        .mockResolvedValue(undefined)
      writeFileSync(
        path.join(root, "src/extra.ts"),
        'import { css } from "@kirana-style/core"\nexport const extra = css({ zIndex: 7 })\n'
      )
      await client.transformRequest("/src/extra.ts")
      await vi.waitFor(() => expect(reload).toHaveBeenCalled())
      reload.mockRestore()

      const tokens = path.join(root, "src/tokens.ts")
      writeFileSync(
        tokens,
        readFileSync(tokens, "utf8").replace("1rem", "2rem")
      )
      const modules = [
        ...(client.moduleGraph.getModulesByFile(
          path.join(root, "src/main.ts")
        ) ?? []),
      ]
      const plugin = server.config.plugins.find(
        (candidate) => candidate.name === "kirana"
      )!
      const hook = plugin.hotUpdate as (
        this: unknown,
        options: unknown
      ) => Promise<unknown[] | undefined>
      await client.transformRequest("/src/tokens.ts")
      const extra = await hook.call(
        { environment: client },
        {
          file: tokens,
          modules: [],
          type: "update",
          timestamp: 0,
          read: () => "",
          server,
        }
      )
      expect(extra?.length).toBe(modules.length)
      const none = await hook.call(
        { environment: client },
        {
          file: path.join(root, "src/plain.ts"),
          modules: [],
          type: "update",
          timestamp: 0,
          read: () => "",
          server,
        }
      )
      expect(none).toBeUndefined()
      expect(PLACEHOLDER).toContain("kirana-placeholder")

      // Unrelated files and unchanged modules pass through.
      type Hook = {
        handler: (this: unknown, ...args: unknown[]) => Promise<unknown>
      }
      const context = {
        addWatchFile() {},
        warn() {},
        error(message: string) {
          throw new Error(message)
        },
      }
      const load = (plugin.load as Hook).handler
      const transform = (plugin.transform as Hook).handler
      expect(
        await load.call(context, path.join(root, "other/stylesheet.css"))
      ).toBeNull()
      expect(await load.call(context, `${stylesheet}?url`)).toBeNull()
      // `?inline` in development is the live stylesheet, as SvelteKit's server render inlines it.
      expect(await load.call(context, `${stylesheet}?inline`)).toContain(
        "@layer kirana"
      )
      expect(
        await transform.call(
          context,
          "// uses @kirana-style/ only in a comment\nexport const x = 1",
          path.join(root, "src/comment.ts")
        )
      ).toBeNull()
      // A burst of stylesheet changes schedules one update.
      const beforeBurst = send.mock.calls.length
      await transform.call(
        context,
        'import { css } from "@kirana-style/core"\nexport const a = css({ order: 1 })',
        path.join(root, "src/a.ts")
      )
      await transform.call(
        context,
        'import { css } from "@kirana-style/core"\nexport const b = css({ order: 2 })',
        path.join(root, "src/b.ts")
      )
      // An affected module that is not in the module graph adds nothing.
      await transform.call(
        context,
        'import { space } from "./tokens"\nimport { css } from "@kirana-style/core"\nexport const c = css({ gap: space[4] })',
        path.join(root, "src/c.ts")
      )
      const ghost = await hook.call(
        { environment: client },
        {
          file: tokens,
          modules: [],
          type: "update",
          timestamp: 0,
          read: () => "",
          server,
        }
      )
      expect(ghost?.length).toBe(modules.length)
      // The held update goes out at most `BURST` (250 ms) after the burst began. A timer started now
      // fires after it, so the update has been sent before the server closes, however fast the
      // machine ran the steps above.
      await new Promise((resolve) => setTimeout(resolve, 250))
      expect(send.mock.calls.length).toBeGreaterThan(beforeBurst)
      expect(JSON.stringify(send.mock.calls.at(-1))).toContain("css-update")
    } finally {
      await server.close()
    }
  })

  it("sends a stylesheet update before any module imported the stylesheet", async () => {
    const root = app()
    const server = await createServer({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [kirana()],
      server: { middlewareMode: true, ws: false, watch: null },
    })
    try {
      const send = vi.spyOn(server.ws, "send")
      const plugin = server.config.plugins.find(
        (candidate) => candidate.name === "kirana"
      )!
      const transform = (
        plugin.transform as {
          handler: (this: unknown, ...args: unknown[]) => Promise<unknown>
        }
      ).handler
      await transform.call(
        { addWatchFile() {}, warn() {}, error() {} },
        'import { css } from "@kirana-style/core"\nexport const a = css({ order: 3 })',
        path.join(root, "src/a.ts")
      )
      await vi.waitFor(() => expect(send).toHaveBeenCalled())
    } finally {
      await server.close()
    }
  })

  it("discards a stylesheet read before a change while its transform runs, then updates it", async () => {
    const root = app()
    // Holds the stylesheet's transform after `load` has read it, as a busy server does.
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    const server = await createServer({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [
        kirana(),
        {
          name: "hold",
          async transform(_code, id) {
            if (id.endsWith("stylesheet.css")) await held
          },
        },
      ],
      server: { middlewareMode: true, ws: false, watch: null },
    })
    try {
      const client = server.environments.client
      await client.transformRequest("/src/main.ts")
      const stylesheet = (await client.pluginContainer.resolveId(
        "@kirana-style/core/stylesheet.css",
        path.join(root, "src/main.ts")
      ))!.id
      const reload = vi.spyOn(client, "reloadModule")
      const request = client.transformRequest(stylesheet)
      await vi.waitFor(() =>
        expect(client.moduleGraph.getModuleById(stylesheet)).toBeTruthy()
      )
      // Let `load` read the stylesheet before the module below adds to it.
      await new Promise((resolve) => setTimeout(resolve, 100))
      const plugin = server.config.plugins.find(
        (candidate) => candidate.name === "kirana"
      )!
      await (
        plugin.transform as {
          handler: (this: unknown, ...args: unknown[]) => Promise<unknown>
        }
      ).handler.call(
        { addWatchFile() {}, warn() {}, error() {} },
        'import { css } from "@kirana-style/core"\nexport const late = css({ order: 5 })',
        path.join(root, "src/late.ts")
      )
      release()
      expect(String((await request)!.code)).not.toContain("order: 5")
      expect(
        client.moduleGraph.getModuleById(stylesheet)!.transformResult
      ).toBeNull()
      // Analysed now: the update reloads it, and a reload of the page reads the change.
      await vi.waitFor(() => expect(reload).toHaveBeenCalled())
      expect(
        String((await client.transformRequest(stylesheet))!.code)
      ).toContain("order: 5")
    } finally {
      await server.close()
    }
  })

  it("stops waiting for a stylesheet no browser asks for", async () => {
    const root = app()
    const server = await createServer({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [kirana()],
      server: {
        middlewareMode: true,
        ws: false,
        watch: null,
        // Otherwise serving main.ts transforms the stylesheet it imports, as a browser would ask for it.
        preTransformRequests: false,
      },
    })
    try {
      const client = server.environments.client
      await client.transformRequest("/src/main.ts")
      const stylesheet = (await client.pluginContainer.resolveId(
        "@kirana-style/core/stylesheet.css",
        path.join(root, "src/main.ts")
      ))!.id
      const module = client.moduleGraph.getModuleById(stylesheet)!
      const invalidate = vi.spyOn(client.moduleGraph, "invalidateModule")
      const tries = () =>
        invalidate.mock.calls.filter(([called]) => called === module).length
      const plugin = server.config.plugins.find(
        (candidate) => candidate.name === "kirana"
      )!
      await (
        plugin.transform as {
          handler: (this: unknown, ...args: unknown[]) => Promise<unknown>
        }
      ).handler.call(
        { addWatchFile() {}, warn() {}, error() {} },
        'import { css } from "@kirana-style/core"\nexport const idle = css({ order: 6 })',
        path.join(root, "src/idle.ts")
      )
      // The first try and twenty more, `QUIET` apart, then none.
      await vi.waitFor(() => expect(tries()).toBe(21), { timeout: 5000 })
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(tries()).toBe(21)
    } finally {
      await server.close()
    }
  })
})
