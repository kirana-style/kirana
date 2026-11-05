import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it, vi } from "vite-plus/test"

import {
  hostRoot,
  moduleHooks,
  moduleTypeScript,
  readJsonc,
} from "../src/config.ts"

import {
  ConfigLoadError,
  Driver,
  findConfigAbove,
  colourOf,
  formatDiagnostic,
  formatDiagnostics,
  position,
  isMusl,
  loadConfigFile,
  loadNative,
  engineOf,
  main,
  platformTriple,
  resolveConfig,
  resolveConfigSync,
  mergeGrammars,
  detectJsx,
  utf16Offset,
} from "../src/index.ts"
import type { PathKey, WrittenValue } from "../src/index.ts"

function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "kirana-compiler-"))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

const INPUT = `import { css } from "@kirana-style/core"
export const row = css({ display: "flex", color: { base: "black", ":hover": "red" } })
export function A({ w }: { w: number }) {
  return <div sx={[row, css({ width: w })]} />
}
`

describe("KRN-INT-001 Driver", () => {
  it("transforms on a worker thread, alike, and on the calling thread under WASI", async () => {
    const files = Object.fromEntries(
      Array.from({ length: 24 }, (_, index) => [
        `src/m${index}.tsx`,
        INPUT.replace("black", `#${String(index).padStart(6, "0")}`),
      ])
    )
    const root = project({ "package.json": '{"name":"app"}', ...files })
    const sync = await Driver.create({ root })
    const parallel = await Driver.create({ root })
    const ids = Object.keys(files).map((name) => path.join(root, name))
    // All at once, as a bundler that runs module hooks concurrently asks for them.
    const results = await Promise.all(
      ids.map((id) =>
        parallel.transformAsync(id, files[path.relative(root, id)]!)
      )
    )
    ids.forEach((id, index) => {
      const expected = sync.transform(id, files[path.relative(root, id)]!)
      expect(results[index]).toEqual(expected)
    })
    // The stylesheet does not depend on the order transforms finished in.
    expect(parallel.stylesheet(true)).toBe(sync.stylesheet(true))
    // A host that writes no source maps asks for none, on either thread, and gets the same code.
    const [id] = ids
    const source = files["src/m0.tsx"]!
    expect(sync.transform(id!, source).map).toContain('"mappings"')
    expect(sync.transform(id!, source, { map: false })).toEqual({
      ...sync.transform(id!, source),
      map: undefined,
    })
    expect(
      (await parallel.transformAsync(id!, source, { map: false })).map
    ).toBeUndefined()

    // The WASI engine has no worker pool here: `transformAsync` compiles on the calling thread.
    const native = loadNative()
    const wasi = {
      ...native,
      __napiBindingTarget: "wasm32-wasi",
      Compiler: class extends native.Compiler {
        override transformManyAsync(): never {
          throw new Error("not under WASI")
        }
      },
    } as unknown as typeof native
    const fallback = await Driver.create({ root, native: wasi })
    expect(fallback.engine).toBe("wasi")
    // A session of its own: its first transform changes its stylesheet.
    expect(
      await fallback.transformAsync(ids[0]!, files["src/m0.tsx"]!)
    ).toEqual({
      ...sync.transform(ids[0]!, files["src/m0.tsx"]!),
      cssChanged: true,
    })
  })

  it("transforms modules and writes the stylesheet", async () => {
    const root = project({
      "package.json": '{"name":"app"}',
      "src/a.tsx": INPUT,
    })
    const driver = await Driver.create({ root })
    expect(driver.root).toBe(root)
    expect(driver.engine).toBe("native")
    expect(driver.configFile).toBeUndefined()
    const result = driver.transform(path.join(root, "src/a.tsx"), INPUT)
    expect(result.code).toContain('__k.sx(["k5O_23ai')
    expect(result.map).toContain(
      `"sources":[${JSON.stringify(path.join(root, "src/a.tsx"))}]`
    )
    expect(result.cssChanged).toBe(true)
    expect(result.dependencies).toEqual([])
    expect(result.diagnostics.map((d) => d.name)).toEqual(["dynamic-bridged"])
    expect(driver.stylesheet(true)).toContain(".k5O_23ai{display:flex}")
    expect(driver.stylesheet(false)).toContain("display: flex;")
    expect(driver.diagnostics()).toEqual([])
    const unchanged = driver.transform(
      path.join(root, "src/b.ts"),
      "export const x = 1"
    )
    expect(unchanged.code).toBeUndefined()
    expect(unchanged.map).toBeUndefined()
    expect(driver.invalidate(path.join(root, "src/a.tsx"))).toEqual([])
    expect(driver.remove(path.join(root, "src/a.tsx"))).toBe(true)
    expect(driver.stylesheet(true)).not.toContain("display")
  })

  it("answers inspection questions for tooling (KRN-DX-001)", async () => {
    const tokens = `import { defineTokens } from "@kirana-style/core"
export const color = defineTokens("color", { ink: { light: "black", dark: "white" } })
`
    const card = `import { css, relation } from "@kirana-style/core"
import { color } from "./tokens"
const card = relation("card")
// é: a two-byte character before the style, so byte and string offsets differ.
export const title = css({ color: { [card.within(":hover")]: color.ink } })
export const Card = () => <article sx={card.anchor}><h2 sx={title} /></article>
`
    const root = project({
      "package.json": '{"name":"app"}',
      "src/tokens.ts": tokens,
      "src/card.tsx": card,
      "node_modules/installed/package.json":
        '{"name":"installed","main":"index.js"}',
      "node_modules/installed/index.js": "export const x = 1",
      "kirana.config.mjs": 'export default { libraries: ["@acme/ds"] }',
      "node_modules/@acme/ds/package.json":
        '{"name":"@acme/ds","main":"index.js"}',
      "node_modules/@acme/ds/index.js": "export const Button = () => null",
    })
    const driver = await Driver.create({ root })
    expect(driver.check(["src"])).toEqual([])
    const [site] = driver.sites(path.join(root, "src/card.tsx"))
    expect(site!.atoms).toEqual([
      expect.objectContaining({
        property: "color",
        value: "light-dark(black, white)",
        conditions: ["card.within(:hover)"],
        layer: "kirana.atoms",
      }),
    ])
    const start = utf16Offset(card, site!.span.start)
    expect(card.slice(start, start + 4)).toBe("css(")
    expect(start).toBeLessThan(site!.span.start)
    expect(driver.tokens()).toEqual([
      expect.objectContaining({
        identity: "color.ink",
        file: "src/tokens.ts",
        light: "black",
        dark: "white",
        variable: false,
      }),
    ])
    const from = path.join(root, "src/card.tsx")
    expect(driver.resolve(from, "./tokens")).toBe(
      path.join(root, "src/tokens.ts")
    )
    expect(driver.resolve(from, "./missing")).toBeUndefined()
    expect(driver.resolve(from, "installed")).toBeUndefined()
    // A listed library is compiled as the application's own, so it resolves as its files do.
    expect(driver.resolve(from, "@acme/ds")).toBe(
      path.join(root, "node_modules/@acme/ds/index.js")
    )
    expect(driver.relations()).toEqual([
      expect.objectContaining({
        name: "card",
        declared_in: ["src/card.tsx"],
        anchored_in: ["src/card.tsx"],
        read_in: ["src/card.tsx"],
      }),
    ])
  })

  it("answers tools in one compile: trace, definitions, the Tailwind lowering", async () => {
    const root = project({
      "package.json": '{"name":"app"}',
      "scales.ts": `import { defineTokens } from "@kirana-style/core"
export const space = defineTokens("space", { "2": "0.5rem" })
`,
      "src/button.ts": `import { recipe } from "@kirana-style/core"
export const button = recipe({
  base: { height: "2rem" },
  variants: { size: { sm: { height: "1.5rem" } } },
})
`,
    })
    const driver = await Driver.create({
      root,
      config: {
        utilities: {
          scales: { space: [{ module: "./scales.ts", export: "space" }] },
          utilities: { p: [{ properties: ["padding"], scale: "space" }] },
        },
      },
    })
    const [answer, missing] = driver.trace([
      { file: "src/button.ts", line: 2, property: "height" },
      { file: "src/missing.ts", line: 1, property: "height" },
    ])
    expect(answer!.file).toBe("src/button.ts")
    expect(answer!.entries.map((entry) => [entry.value, entry.part])).toEqual([
      ["1.5rem", { options: { size: "sm" }, compound: false }],
      ["2rem", { options: {}, compound: false }],
    ])
    expect(answer!.entries[0]!.step).toBe(0)
    expect(missing!.error).toMatch(/^cannot read .*src\/missing\.ts$/)
    const exported = driver.export(["src"], { definitions: true })
    expect(exported.recipes[0]!.parts![1]!.entries[0]!.value).toBe("1.5rem")
    const written: [PathKey[] | undefined, WrittenValue | undefined] = [
      exported.recipes[0]!.parts![1]!.entries[0]!.path,
      exported.recipes[0]!.parts![1]!.entries[0]!.written,
    ]
    expect(written).toEqual([["height"], "1.5rem"])
    expect(driver.export(["src"]).recipes[0]!.parts).toBeUndefined()
    const lowered = driver.lowerTailwind("p-2", "src/card.tsx")
    expect(lowered.style).toBe("css({\n    padding: space[2],\n  })")
    expect(lowered.module).toContain('import { space } from "../scales"')
    const bare = await Driver.create({ root })
    expect(() => bare.lowerTailwind("p-2")).toThrow(
      "the Tailwind lowering needs a utility grammar"
    )
  })

  it("loads configuration files and inline overrides", async () => {
    const ts = project({
      "kirana.config.ts": 'export default { names: { prefix: "ds" } }',
    })
    const load = (url: string) => import(url)
    expect((await loadConfigFile(ts, load)).config).toEqual({
      names: { prefix: "ds" },
    })
    const driver = await Driver.create({
      root: ts,
      config: { dynamic: { branchBudget: 4 } },
      importModule: load,
    })
    expect(driver.configFile).toBe(path.join(ts, "kirana.config.ts"))
    const json = project({
      "kirana.config.json": '{"layers":{"before":["reset"]}}',
    })
    expect(
      JSON.parse((await resolveConfig(json, { jsx: "react" })).json)
    ).toEqual({
      layers: { before: ["reset"] },
      jsx: "react",
      root: json,
    })
    // A host whose `Function` code has no `import()` (a CommonJS project's webpack) falls back to
    // `require()`; any other failure to load is the configuration's own and is thrown.
    const noImport = Object.assign(new Error("no callback"), {
      code: "ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING",
    })
    expect(
      (await loadConfigFile(ts, () => Promise.reject(noImport))).config
    ).toEqual({ names: { prefix: "ds" } })
    await expect(
      loadConfigFile(ts, () => Promise.reject(new Error("syntax")))
    ).rejects.toThrow("syntax")
    const empty = project({ "kirana.config.mjs": "export const unused = 1" })
    expect((await loadConfigFile(empty, load)).config).toEqual({})
    expect((await loadConfigFile(project({}))).file).toBeUndefined()
  })

  it("loads a TypeScript configuration as written in a CommonJS package", () => {
    // `"type": "commonjs"`, as `npm init` writes: Node.js reads `.ts` as CommonJS, and without the
    // hook stops at `import`. Node.js itself, not Vitest's module runner, so its hooks apply.
    const root = project({
      "package.json": '{ "type": "commonjs" }',
      "kirana.config.ts":
        'import { prefix } from "./names.ts"\nexport default { names: { prefix: prefix as string } }\n',
      "names.ts": 'export const prefix = "ds"\n',
    })
    const config = pathToFileURL(
      path.join(import.meta.dirname, "../src/config.ts")
    ).href
    const run = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { loadConfigFile, resolveConfigSync } from ${JSON.stringify(config)}
console.log(JSON.stringify((await loadConfigFile(${JSON.stringify(root)})).config))
console.log(resolveConfigSync(${JSON.stringify(root)}).json)`,
      ],
      { encoding: "utf8" }
    )
    expect(run.stderr).toBe("")
    const [loaded, synchronous] = run.stdout.trim().split("\n")
    expect(JSON.parse(loaded!)).toEqual({ names: { prefix: "ds" } })
    expect(JSON.parse(synchronous!).names).toEqual({ prefix: "ds" })
  })

  it("loads a CommonJS-typed .ts file as an ES module only when it has import or export statements", () => {
    const loaded = (format: string, source: string) =>
      moduleTypeScript(
        "file:///p/kirana.config.ts",
        { conditions: [], format: undefined, importAttributes: {} },
        () => ({ format, source })
      )
    expect(
      loaded("commonjs-typescript", 'import { x } from "./x.ts"').format
    ).toBe("module-typescript")
    expect(loaded("commonjs-typescript", "export default {}").format).toBe(
      "module-typescript"
    )
    expect(loaded("commonjs-typescript", "module.exports = {}").format).toBe(
      "commonjs-typescript"
    )
    expect(loaded("module", "export default {}").format).toBe("module")
    // Bun and Deno have no `registerHooks`, and need none.
    expect(() => moduleHooks(undefined).deregister()).not.toThrow()
  })

  it("reads JSON with comments and trailing commas in one pass", () => {
    expect(
      readJsonc(`{
        // a comment, "with a quote"
        "a": "a \\" // not a comment, }",
        /* a block */ "b": [1, 2, ],
        "c": ",}",
      }`)
    ).toEqual({ a: 'a " // not a comment, }', b: [1, 2], c: ",}" })
    expect(readJsonc('{ "a": 1 } // to the end')).toEqual({ a: 1 })
    expect(readJsonc('{ "a": 1 } /* unclosed')).toEqual({ a: 1 })
    expect(() => readJsonc('{ "a": "unclosed')).toThrow()
  })

  it("detects the jsx mode from tsconfig.json unless configuration names one", async () => {
    const tsconfig = (source: string) =>
      project({
        "tsconfig.json": `{
          // comments and trailing commas are allowed
          "compilerOptions": { "jsx": "preserve", "jsxImportSource": ${JSON.stringify(source)}, /* here too */ },
          "include": ["src/**/*", "http://not-a-comment"],
        }`,
      })
    expect(detectJsx(tsconfig("preact"))).toBe("preact")
    expect(detectJsx(tsconfig("solid-js"))).toBe("solid")
    expect(detectJsx(tsconfig("@qwik.dev/core"))).toBe("qwik")
    expect(detectJsx(tsconfig("react"))).toBeUndefined()
    expect(detectJsx(project({ "tsconfig.json": "{}" }))).toBeUndefined()
    expect(
      detectJsx(project({ "tsconfig.json": "{ not json" }))
    ).toBeUndefined()
    expect(detectJsx(project({}))).toBeUndefined()

    const root = tsconfig("preact")
    expect(JSON.parse((await resolveConfig(root)).json).jsx).toBe("preact")
    expect(
      JSON.parse((await resolveConfig(root, { jsx: "react" })).json).jsx
    ).toBe("react")
    const driver = await Driver.create({ root })
    expect(
      driver.transform(
        path.join(root, "src/a.tsx"),
        'import { css } from "@kirana-style/core"\nexport const A = () => <p sx={css({ display: "flex" })} />\n'
      ).code
    ).toContain('<p class="')
  })

  it("opens synchronously, for hosts whose hooks are (Jest)", async () => {
    const root = project({
      "kirana.config.mjs": 'export default { names: { prefix: "ds" } }',
    })
    const driver = Driver.createSync({ root })
    expect(driver.prefix).toBe("ds")
    expect(driver.configFile).toBe(path.join(root, "kirana.config.mjs"))
    expect(
      JSON.parse(
        resolveConfigSync(project({ "kirana.config.json": '{"jsx":"solid"}' }))
          .json
      ).jsx
    ).toBe("solid")
    expect(Driver.createSync().root).toBe(process.cwd())
    // A relative root is read from the working directory, its configuration module included.
    const relative = path.relative(process.cwd(), root)
    expect(Driver.createSync({ root: relative }).configFile).toBe(
      path.join(root, "kirana.config.mjs")
    )
    expect((await Driver.create({ root: relative })).root).toBe(root)
  })

  it("merges presets' utility grammars in order, the project's last", async () => {
    expect(mergeGrammars([undefined], "/app")).toBeUndefined()
    const merged = mergeGrammars(
      [
        {
          scales: { space: [{ module: "@acme/preset", export: "space" }] },
          utilities: { p: [{ properties: ["padding"], scale: "space" }] },
          variants: { hover: ":hover" },
        },
        {},
        {
          scales: { color: [{ module: "./src/theme.ts", export: "theme" }] },
          utilities: { p: [{ static: { padding: "0" } }] },
          variants: { hover: ":hover:not(:disabled)" },
        },
      ],
      "/app"
    )!
    expect(merged.scales).toEqual({
      space: [{ module: "@acme/preset", export: "space" }],
      color: [
        { module: path.resolve("/app", "src/theme.ts"), export: "theme" },
      ],
    })
    expect(merged.utilities!.p).toEqual([{ static: { padding: "0" } }])
    expect(merged.variants!.hover).toBe(":hover:not(:disabled)")

    // The engine receives the merged grammar as `utilities`; `presets` itself stays in the Driver.
    const root = project({})
    const json = JSON.parse(
      (
        await resolveConfig(root, {
          presets: [
            { name: "a", utilities: { variants: { hover: ":hover" } } },
          ],
        })
      ).json
    )
    expect(json.presets).toBeUndefined()
    expect(json.utilities).toEqual({
      scales: {},
      utilities: {},
      variants: { hover: ":hover" },
    })
    expect(
      JSON.parse((await resolveConfig(root)).json).utilities
    ).toBeUndefined()
  })

  it("rejects invalid configuration with diagnostics", async () => {
    const root = project({})
    await expect(
      Driver.create({ root, config: { names: { prefix: "K" } } })
    ).rejects.toThrow("invalid-config")
  })

  it("answers a module the engine would reuse without asking the engine again", async () => {
    const files = {
      "package.json": '{"name":"app"}',
      "src/tokens.ts": `import { defineTokens } from "@kirana-style/core"\nexport const space = defineTokens("space", { md: "1rem" })\n`,
      "src/a.tsx": `import { css } from "@kirana-style/core"\nimport { space } from "./tokens"\nexport const a = css({ padding: space.md })\n`,
      "src/b.tsx": INPUT,
      "src/c.tsx": INPUT.replace("black", "navy"),
      "src/missing.tsx": `import { css } from "@kirana-style/core"\nimport { gap } from "./nowhere"\nexport const m = css({ gap })\n`,
    }
    const root = project(files)
    const at = (name: keyof typeof files) => path.join(root, name)
    const source = (name: keyof typeof files) => files[name]
    const native = loadNative()
    const asked: string[] = []
    const counting = {
      ...native,
      Compiler: class extends native.Compiler {
        override transform(id: string, code: string, map?: boolean | null) {
          asked.push(path.basename(id))
          return super.transform(id, code, map)
        }
        override transformManyAsync(
          modules: { id: string; code: string }[],
          map?: boolean | null
        ) {
          for (const module of modules) asked.push(path.basename(module.id))
          return super.transformManyAsync(modules, map)
        }
      },
    } as unknown as typeof native
    const driver = await Driver.create({ root, native: counting })
    driver.reuseTransforms()
    const ask = () => asked.splice(0)

    // The same source again is the engine's reused transform, answered here.
    const first = driver.transform(at("src/a.tsx"), source("src/a.tsx"))
    expect(driver.transform(at("src/a.tsx"), source("src/a.tsx"))).toEqual({
      ...first,
      cssChanged: false,
    })
    expect(
      await driver.transformAsync(at("src/a.tsx"), source("src/a.tsx"))
    ).toEqual({ ...first, cssChanged: false })
    expect(ask()).toEqual(["a.tsx"])
    // Another source, or another source map setting, is the engine's to answer.
    driver.transform(at("src/a.tsx"), `${source("src/a.tsx")}// edit\n`)
    driver.transform(at("src/a.tsx"), `${source("src/a.tsx")}// edit\n`, {
      map: false,
    })
    expect(ask()).toEqual(["a.tsx", "a.tsx"])
    // Another module compiled: the engine checks again what this one read, and reuses it.
    driver.transform(at("src/b.tsx"), source("src/b.tsx"))
    const again = driver.transform(at("src/a.tsx"), source("src/a.tsx"))
    expect(again).toEqual({ ...first, cssChanged: false })
    driver.transform(at("src/a.tsx"), source("src/a.tsx"))
    expect(ask()).toEqual(["b.tsx", "a.tsx"])
    // A changed file it read: the engine compiles it again.
    expect(driver.invalidate(at("src/tokens.ts"))).toContain(at("src/a.tsx"))
    driver.transform(at("src/a.tsx"), source("src/a.tsx"))
    expect(ask()).toEqual(["a.tsx"])
    // A module that missed an import compiles each time, as the engine does.
    driver.transform(at("src/missing.tsx"), source("src/missing.tsx"))
    driver.transform(at("src/missing.tsx"), source("src/missing.tsx"))
    expect(ask()).toEqual(["missing.tsx", "missing.tsx"])
    // Two compiles at once: the one that settles second ran while the other compiled, so neither
    // is kept from this round; the engine reuses both next time, and the Driver keeps them then.
    await Promise.all([
      driver.transformAsync(at("src/b.tsx"), `${source("src/b.tsx")}// edit\n`),
      driver.transformAsync(at("src/c.tsx"), source("src/c.tsx")),
    ])
    for (let round = 0; round < 2; round += 1) {
      await driver.transformAsync(
        at("src/b.tsx"),
        `${source("src/b.tsx")}// edit\n`
      )
      await driver.transformAsync(at("src/c.tsx"), source("src/c.tsx"))
    }
    expect(ask().sort()).toEqual(["b.tsx", "b.tsx", "c.tsx", "c.tsx"])
  })

  it("asks the engine once for the modules one turn of the event loop hands it (KRN-CMP-009)", async () => {
    const files = Object.fromEntries(
      Array.from({ length: 16 }, (_, index) => [
        `src/t${index}.tsx`,
        INPUT.replace("black", `#${String(index + 100).padStart(6, "0")}`),
      ])
    )
    const root = project({ "package.json": '{"name":"app"}', ...files })
    const ids = Object.keys(files).map((name) => path.join(root, name))
    const source = (id: string) => files[path.relative(root, id)]!
    const native = loadNative()
    const batches: { count: number; map: boolean | null | undefined }[] = []
    const counting = {
      ...native,
      Compiler: class extends native.Compiler {
        override transformManyAsync(
          modules: { id: string; code: string }[],
          map?: boolean | null
        ) {
          batches.push({ count: modules.length, map })
          return super.transformManyAsync(modules, map)
        }
      },
    } as unknown as typeof native
    const driver = await Driver.create({ root, native: counting })
    const sync = await Driver.create({ root })
    // Half with source maps and half without, all in one turn: the engine is asked twice, once per
    // source map setting, and each module gets its own transform.
    const results = await Promise.all(
      ids.map((id, index) =>
        driver.transformAsync(id, source(id), { map: index % 2 === 0 })
      )
    )
    expect(batches).toEqual([
      { count: 8, map: true },
      { count: 8, map: false },
    ])
    ids.forEach((id, index) => {
      expect(results[index]).toEqual(
        sync.transform(id, source(id), { map: index % 2 === 0 })
      )
    })
    expect(driver.stylesheet(true)).toBe(sync.stylesheet(true))
    // The next turn asks again; a module alone is a batch of one.
    await driver.transformAsync(ids[0]!, source(ids[0]!))
    expect(batches.slice(2)).toEqual([{ count: 1, map: true }])
    // An engine that fails a batch fails each of its transforms.
    const failing = {
      ...native,
      Compiler: class extends native.Compiler {
        override transformManyAsync(): Promise<never> {
          return Promise.reject(new Error("engine down"))
        }
      },
    } as unknown as typeof native
    const broken = await Driver.create({ root, native: failing })
    const attempts = ids
      .slice(0, 2)
      .map((id) => broken.transformAsync(id, source(id)))
    await expect(Promise.all(attempts)).rejects.toThrow("engine down")
    await expect(attempts[1]).rejects.toThrow("engine down")
  })

  it("starts a dense build once, however many environments ask (D-084)", async () => {
    const root = project({
      "package.json": '{"name":"app"}',
      "src/a.tsx": INPUT,
    })
    const file = path.join(root, "src/a.tsx")
    const native = loadNative()
    let marked = 0
    let compiled = 0
    const counting = {
      ...native,
      Compiler: class extends native.Compiler {
        override markDense() {
          marked += 1
          super.markDense()
        }
        override transform(id: string, code: string, map?: boolean | null) {
          compiled += 1
          return super.transform(id, code, map)
        }
      },
    } as unknown as typeof native
    const driver = await Driver.create({ root, native: counting })
    driver.reuseTransforms()
    driver.markDense()
    const first = driver.transform(file, INPUT)
    // The second environment's start changes nothing, so the answer kept from the first stands.
    driver.markDense()
    expect(driver.transform(file, INPUT)).toEqual({
      ...first,
      cssChanged: false,
    })
    expect([marked, compiled]).toEqual([1, 1])
  })

  it("gives the engine's freed memory back a second after the last call into it, or when asked (D-123)", async () => {
    const root = project({
      "package.json": '{"name":"app"}',
      "src/a.tsx": INPUT,
    })
    const file = path.join(root, "src/a.tsx")
    const native = loadNative()
    // The engine's own: it gives back what its allocator holds free.
    expect(new native.Compiler("{}").releaseMemory()).toBeUndefined()
    let released = 0
    class Counting extends native.Compiler {
      override releaseMemory() {
        released += 1
      }
    }
    const driver = await Driver.create({
      root,
      native: { ...native, Compiler: Counting },
    })
    const idle = () => new Promise((resolve) => setTimeout(resolve, 1200))
    // Changes in a row: one release, a second after the last.
    driver.transform(file, INPUT)
    driver.transform(file, `${INPUT}// edit\n`)
    driver.invalidate(file)
    expect(released).toBe(0)
    await idle()
    expect(released).toBe(1)
    // Asked at once, the pending release is the same one.
    driver.transform(file, INPUT)
    driver.releaseMemory()
    expect(released).toBe(2)
    await idle()
    expect(released).toBe(2)
    // A dev server writes the stylesheet after its compiles: what that freed goes back too.
    driver.stylesheet(false)
    await idle()
    expect(released).toBe(3)
  }, 10_000)

  it("defaults the root to the working directory", async () => {
    const driver = await Driver.create()
    expect(driver.root).toBe(process.cwd())
  })
})

describe("native loading", () => {
  it("maps platforms to napi-rs triples", () => {
    expect(platformTriple("linux", "x64", false)).toBe("linux-x64-gnu")
    expect(platformTriple("linux", "arm64", true)).toBe("linux-arm64-musl")
    expect(platformTriple("win32", "x64", false)).toBe("win32-x64-msvc")
    expect(platformTriple("darwin", "arm64", false)).toBe("darwin-arm64")
    expect(isMusl({ header: { glibcVersionRuntime: "2.39" } })).toBe(false)
    expect(isMusl({ header: {} })).toBe(true)
    expect(isMusl(undefined)).toBe(true)
  })

  it("asks Node's diagnostic report for the C library once per process (KF-058)", async () => {
    vi.resetModules()
    const report = vi.spyOn(process.report, "getReport")
    const { loadNative: load } = await import("../src/native.ts")
    for (let i = 0; i < 3; i++) load({}, (id) => ({ from: id }))
    expect(report).toHaveBeenCalledTimes(process.platform === "linux" ? 1 : 0)
    report.mockRestore()
  })

  it("prefers an installed platform package, then the workspace build, then WASI", () => {
    const notFound = (id: string) =>
      Object.assign(new Error(`Cannot find module '${id}'`), {
        code: "MODULE_NOT_FOUND",
      })
    const tried: string[] = []
    const fromPackage = loadNative({}, (id) => {
      tried.push(id)
      return { from: id }
    })
    expect(tried[0]).toMatch(/^@kirana-style\/compiler-/)
    expect(fromPackage).toEqual({ from: tried[0] })

    const local = loadNative({}, (id) => {
      if (id.startsWith("@kirana-style/")) throw notFound(id)
      return { from: id }
    })
    expect(local).toEqual({ from: expect.stringMatching(/kirana\..+\.node$/) })

    // Nothing native installed: the WASI package, then the workspace's WASI build.
    const wasi = { __napiBindingTarget: "wasm32-wasi" }
    const fromWasi = loadNative({}, (id) => {
      if (!id.includes("wasm32-wasi")) throw notFound(id)
      return wasi
    })
    expect(fromWasi).toBe(wasi)
    expect(engineOf(fromWasi)).toBe("wasi")
    expect(engineOf(fromPackage)).toBe("native")
    const workspaceWasi = loadNative({}, (id) => {
      if (!id.endsWith("kirana.wasi.cjs")) throw notFound(id)
      return wasi
    })
    expect(workspaceWasi).toBe(wasi)

    // Forced, the native addon is not even tried.
    const forced: string[] = []
    loadNative({ KIRANA_FORCE_WASI: "1" }, (id) => {
      forced.push(id)
      return wasi
    })
    expect(forced).toEqual(["@kirana-style/compiler-wasm32-wasi"])

    // A dependency of an installed package missing is a failure, not "not installed".
    const inner = Object.assign(
      new Error("Cannot find module '@napi-rs/wasm-runtime'"),
      {
        code: "MODULE_NOT_FOUND",
      }
    )
    expect(() =>
      loadNative({ KIRANA_FORCE_WASI: "1" }, () => {
        throw inner
      })
    ).toThrow(inner)
  })

  it("falls back to WASI when the native addon is installed but broken, and says so", () => {
    const broken = new Error("wrong ABI")
    const warnings: string[] = []
    const wasi = { __napiBindingTarget: "wasm32-wasi" }
    const loaded = loadNative(
      {},
      (id) => {
        if (id.includes("wasm32-wasi")) return wasi
        throw broken
      },
      (message) => warnings.push(message)
    )
    expect(loaded).toBe(wasi)
    expect(warnings[0]).toContain("wrong ABI")
    // Without a WASI build, the addon's own error is the one to see.
    expect(() =>
      loadNative({}, () => {
        throw broken
      })
    ).toThrow(broken)
    expect(() =>
      loadNative({}, (id) => {
        throw Object.assign(new Error(`Cannot find module '${id}'`), {
          code: "MODULE_NOT_FOUND",
        })
      })
    ).toThrow("Kirana has no engine for")
  })

  it.skipIf(
    !existsSync(path.join(import.meta.dirname, "../kirana.wasm32-wasi.wasm"))
  )("compiles the same output with the WASI engine", async () => {
    const wasi = loadNative({ KIRANA_FORCE_WASI: "1" })
    expect(engineOf(wasi)).toBe("wasi")
    const json = JSON.stringify({ root: import.meta.dirname })
    const native = new (loadNative().Compiler)(json)
    const other = new wasi.Compiler(json)
    const file = path.join(import.meta.dirname, "a.tsx")
    expect(other.transform(file, INPUT).code).toBe(
      native.transform(file, INPUT).code
    )
    expect(other.stylesheet(true)).toBe(native.stylesheet(true))
  })

  it("honours KIRANA_NATIVE_PATH", async () => {
    const { createRequire } = await import("node:module")
    const require = createRequire(import.meta.url)
    const binding = loadNative()
    // The engine this process loaded: the instrumented build under coverage, which sets the
    // variable, else the workspace's. A second engine cannot load beside it (glibc's static TLS).
    const loaded =
      process.env.KIRANA_NATIVE_PATH ??
      require.resolve("../kirana.linux-x64-gnu.node")
    expect(loadNative({ KIRANA_NATIVE_PATH: loaded })).toBe(binding)
  })
})

describe("Node-API boundary", () => {
  it("rejects arguments of the wrong type", () => {
    const native = loadNative() as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    > & {
      Compiler: new (
        ...args: unknown[]
      ) => Record<string, (...args: unknown[]) => unknown>
    }
    expect(() => native.runCli!(123)).toThrow()
    expect(() => native.runCli!(["kirana-style"], "yes")).toThrow()
    expect(() => native.renderDiagnostics!(1, {}, false)).toThrow()
    expect(() => native.renderDiagnostics!("[]", { a: 1 }, false)).toThrow()
    expect(() => native.renderDiagnostics!("[]", {}, "yes")).toThrow()
    expect(() => native.renderDiagnostics!("{", {}, false)).toThrow()
    expect(() => new native.Compiler(1)).toThrow()
    const compiler = new native.Compiler("{}")
    expect(() => compiler.transform!(1, 2)).toThrow()
    expect(() => compiler.stylesheet!("yes")).toThrow()
    expect(() => compiler.invalidate!(1)).toThrow()
    expect(() => compiler.remove!(1)).toThrow()
    expect(compiler.diagnostics!()).toBe("[]")
    expect(() => compiler.check!("src")).toThrow()
    expect(() => compiler.sites!(1)).toThrow()
    expect(compiler.tokens!()).toBe("[]")
    expect(compiler.relations!()).toBe("[]")
    expect(() => native.runLsp!(1)).toThrow()
    expect(() => compiler.resolve!(1, 2)).toThrow()
  })
})

describe("diagnostic formatting", () => {
  const base = {
    code: "KRN1403",
    name: "relation-placement",
    severity: "error" as const,
    span: { start: 4, end: 9 },
    message: "m",
  }

  it("draws the engine's graphical report, as the command line prints it (D-116)", () => {
    expect(formatDiagnostic({ ...base, file: "a.tsx", help: ["h"] })).toBe(
      "  × KRN1403 relation-placement: m (a.tsx)\n  help: h"
    )
    // Offsets count UTF-8 bytes: `é` is two.
    expect(
      formatDiagnostic(
        { ...base, file: "a.tsx", help: [], span: { start: 5, end: 6 } },
        "ab\n\u00e9cd"
      )
    ).toBe(
      [
        "  × KRN1403 relation-placement: m",
        "   ╭─[a.tsx:2:2]",
        " 1 │ ab",
        " 2 │ \u00e9cd",
        "   ·  ─",
        "   ╰────",
      ].join("\n")
    )
    expect(
      formatDiagnostic(
        { ...base, file: "a.tsx", help: [], span: { start: 0, end: 0 } },
        "abc"
      )
    ).toBe("  × KRN1403 relation-placement: m (a.tsx)")
    expect(formatDiagnostic({ ...base, file: "", help: [] })).toBe(
      "  × KRN1403 relation-placement: m"
    )
  })

  it("hands each file to the engine once, and colours on request", () => {
    const asked: string[] = []
    const sourceOf = (file: string) => {
      asked.push(file)
      return file === "a.tsx" ? "const a = 1\n" : undefined
    }
    const at = (file: string, start: number) => ({
      ...base,
      file,
      help: [],
      span: { start, end: start + 1 },
    })
    const reports = formatDiagnostics(
      [at("a.tsx", 6), at("b.tsx", 1), at("a.tsx", 10), at("", 0)],
      sourceOf
    )
    expect(asked).toEqual(["a.tsx", "b.tsx"])
    expect(reports).toHaveLength(4)
    expect(reports[0]).toContain("╭─[a.tsx:1:7]")
    expect(reports[1]).toBe("  × KRN1403 relation-placement: m (b.tsx)")
    expect(reports[2]).toContain("╭─[a.tsx:1:11]")
    const [coloured] = formatDiagnostics([at("a.tsx", 6)], sourceOf, {
      colour: true,
    })
    expect(coloured).toContain("\u001b[38;2;225;80;80;1m×\u001b[0m")
    // Without the sources, each report names its file.
    expect(formatDiagnostics([at("a.tsx", 6)])).toEqual([
      "  × KRN1403 relation-placement: m (a.tsx)",
    ])
    // Nothing to draw asks nothing of the engine.
    expect(formatDiagnostics([], sourceOf, { native: {} as never })).toEqual([])
    expect(() =>
      formatDiagnostics([{ ...at("", 0), name: "no-such" }])
    ).toThrow("unknown diagnostic `no-such`")
  })

  it("colours a terminal's output unless the environment says otherwise", () => {
    expect(colourOf({ isTTY: true }, {})).toBe(true)
    expect(colourOf({}, {})).toBe(false)
    expect(colourOf({ isTTY: true }, { NO_COLOR: "1" })).toBe(false)
    expect(colourOf({ isTTY: true }, { NO_COLOR: "" })).toBe(true)
    expect(colourOf({}, { FORCE_COLOR: "1", NO_COLOR: "1" })).toBe(true)
    expect(colourOf({ isTTY: true }, { FORCE_COLOR: "0" })).toBe(false)
    expect(colourOf({ isTTY: true }, { FORCE_COLOR: "false" })).toBe(false)
  })

  it("places every offset as walking the source from its start does (KF-075)", () => {
    const walked = (source: string, offset: number) => {
      const lines = Buffer.from(source)
        .subarray(0, offset)
        .toString()
        .split("\n")
      return `${lines.length}:${lines.at(-1)!.length + 1}`
    }
    // Two-, three- and four-byte characters, a CRLF, empty lines, and no newline at the end.
    const first = "ab\n\u00e9cd\r\n\n\u20ac \u{1f600}x\n\nend"
    const second = "\n\none"
    const bytes = Buffer.byteLength(first)
    // Alternating sources: each is indexed again when it comes back.
    for (let offset = 0; offset <= bytes + 2; offset++) {
      expect(position(first, offset)).toBe(walked(first, offset))
      expect(position(second, offset % 6)).toBe(walked(second, offset % 6))
    }
    // The same source asked about again keeps its index.
    expect(position(first, 0)).toBe("1:1")
    expect(position(first, 3)).toBe("2:1")
  })
})

describe("kirana command", () => {
  it("builds, checks and traces", async () => {
    const root = project({
      "package.json": '{"name":"app"}',
      "src/a.tsx": INPUT,
    })
    let output = ""
    const write = (text: string) => (output += text)
    expect(await main(["check", path.join(root, "src")], root, write)).toBe(0)
    expect(output).toContain("1 diagnostic(s), 0 error(s)")
    output = ""
    const out = path.join(root, "out.css")
    expect(
      await main(
        ["build", path.join(root, "src"), "--out", out, "--minify"],
        root,
        write
      )
    ).toBe(0)
    output = ""
    expect(
      await main(
        ["trace", `${path.join(root, "src/a.tsx")}:2`, "color"],
        root,
        write
      )
    ).toBe(0)
    expect(output).toContain("✓ red")
    output = ""
    expect(await main(["--version"], root, write)).toBe(0)
    expect(output).toContain("kirana")
  })

  it("reads each path's own configuration, or the one --config names (KF-003)", async () => {
    const quiet = '{"diagnostics":{"dynamic-bridged":"off"}}'
    const root = project({
      "package.json": '{"name":"workspace"}',
      "packages/ui/src/a.tsx": INPUT,
      "apps/web/kirana.config.json": quiet,
      "apps/web/src/a.tsx": INPUT,
    })
    let output = ""
    const write = (text: string) => (output += text)
    const run = async (...argv: string[]) => {
      output = ""
      return main(argv, root, write)
    }
    expect(await run("check", "packages/ui/src", "apps/web/src")).toBe(0)
    expect(output).toContain("no kirana.config: packages/ui/src\n")
    expect(output).toContain(
      `${path.join("apps", "web", "kirana.config.json")}: apps/web/src\n0 diagnostic(s)`
    )
    expect(output).toContain("1 diagnostic(s), 0 error(s)")
    await run("check", "packages/ui/src", "apps/web/src", "--format", "json")
    expect(
      (JSON.parse(output) as { name: string }[]).map((d) => d.name)
    ).toEqual(["dynamic-bridged"])
    // One group, the working directory's: printed with no header.
    await run("check", "packages/ui/src", "--max-warnings", "3")
    expect(output.startsWith("no kirana.config")).toBe(false)
    // --config makes every path read one file, in either spelling.
    await run(
      "check",
      "packages/ui/src",
      "--config",
      "apps/web/kirana.config.json"
    )
    expect(output).toContain("0 diagnostic(s)")
    await run(
      "check",
      "packages/ui/src",
      "--config=apps/web/kirana.config.json"
    )
    expect(output).toContain("0 diagnostic(s)")
    // trace: each location is a path; JSON answers from several groups are one array.
    await run(
      "trace",
      "packages/ui/src/a.tsx:2",
      "color",
      "apps/web/src/a.tsx:2",
      "display",
      "--format=json"
    )
    expect(
      (JSON.parse(output) as { property: string }[]).map((a) => a.property)
    ).toEqual(["color", "display"])
    // One group's JSON is printed as the engine wrote it.
    await run("trace", "apps/web/src/a.tsx:2", "color", "--format", "json")
    expect((JSON.parse(output) as unknown[]).length).toBe(1)
    await run("trace", "apps/web/src/a.tsx:2", "color")
    expect(output).toContain(
      `${path.join("apps", "web", "kirana.config.json")}: apps/web/src/a.tsx\ncolor at`
    )
    // export reads one configuration.
    expect(await run("export", "packages/ui/src", "apps/web/src")).toBe(2)
    expect(output).toContain(
      `these paths read 2: ., ${path.join("apps", "web", "kirana.config.json")}; pass --config <file>`
    )
    // An absolute `--out`: a relative one is the process's directory, which is the repository.
    expect(
      await run("export", "apps/web/src", "--out", path.join(root, "out.json"))
    ).toBe(0)
    // A path that does not exist is looked up from its parent, and the engine fails on it.
    expect(await run("check", "apps/web/missing.tsx")).toBe(1)
  })

  it("says which configuration failed to load, and why (KF-016)", async () => {
    const root = project({
      "package.json": '{"name":"app","type":"module"}',
      "kirana.config.ts":
        'import { prefix } from "./core/names"\nexport default { names: { prefix } }\n',
      "core/names.ts": 'export const prefix = "q"\n',
      "src/a.ts": "export const x = 1\n",
      "other/kirana.config.json": "{ not json",
    })
    let output = ""
    const write = (text: string) => (output += text)
    expect(await main(["check", "src"], root, write)).toBe(2)
    expect(output).toBe(
      `loading ${path.join(root, "kirana.config.ts")}: ${path.join(root, "core", "names")} not found; Node.js loads the configuration without a bundler, so its relative imports, and theirs, need their extension (\`./states.ts\`)\n`
    )
    output = ""
    expect(
      await main(
        ["check", "src", "--config", "other/kirana.config.json"],
        root,
        write
      )
    ).toBe(2)
    expect(output).toMatch(/^loading .*kirana\.config\.json: /)
    expect(new ConfigLoadError("x.ts", "plain").message).toBe(
      "loading x.ts: plain"
    )
    expect(
      new ConfigLoadError(
        "x.ts",
        new Error("Cannot find package 'zod' imported from x.ts")
      ).message
    ).toBe("loading x.ts: zod not found")
    // Anything else still throws.
    await expect(
      main(["check"], path.join(root, "src"), write, {
        runCli: () => {
          throw new Error("engine")
        },
      } as unknown as Parameters<typeof main>[3])
    ).rejects.toThrow()
    expect(findConfigAbove(path.parse(root).root)).toBeUndefined()
  })

  it("reads the package root's configuration from a folder of the package that has none (KF-069)", async () => {
    // Vite's `root: "viewer"`, and the configuration `ui init` wrote beside `package.json`.
    const root = project({
      "package.json": '{"name":"app"}',
      "kirana.config.json": '{"names":{"prefix":"zz"}}',
      "viewer/index.html": "",
      "own/kirana.config.json": '{"names":{"prefix":"own"}}',
      "nested/package.json": '{"name":"nested"}',
    })
    const driver = await Driver.create({ root: path.join(root, "viewer") })
    expect([driver.root, driver.prefix]).toEqual([root, "zz"])
    expect(
      Driver.createSync({ root: path.join(root, "viewer") }).configFile
    ).toBe(path.join(root, "kirana.config.json"))
    // A folder with its own configuration keeps it; a package of its own stops the search.
    expect(hostRoot(path.join(root, "own"))).toBe(path.join(root, "own"))
    expect(hostRoot(path.join(root, "nested"))).toBe(path.join(root, "nested"))
    // No package and no configuration up to the file system's root: the root asked for.
    const bare = project({})
    expect(hostRoot(bare)).toBe(bare)
  })

  it("hands `kirana-style lsp` to the language server with the resolved configuration", async () => {
    const root = project({ "kirana.config.json": '{"names":{"prefix":"q"}}' })
    let received = ""
    const native = {
      runLsp: (json: string) => {
        received = json
        return 7
      },
    } as unknown as Parameters<typeof main>[3]
    expect(await main(["lsp"], root, () => {}, native)).toBe(7)
    expect(JSON.parse(received).names.prefix).toBe("q")
  })

  it("serves LSP over stdio from the Node entry", async () => {
    const root = project({
      "package.json": '{"name":"app"}',
      "src/a.tsx": INPUT,
    })
    const bin = path.join(import.meta.dirname, "../../cli/bin/kirana-style.ts")
    const child = spawn(process.execPath, [bin, "lsp"], { cwd: root })
    const frame = (message: object) => {
      const body = JSON.stringify({ jsonrpc: "2.0", ...message })
      return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    }
    let received = ""
    child.stdout.on("data", (chunk: Buffer) => (received += chunk.toString()))
    child.stdin.write(
      frame({ id: 1, method: "initialize", params: { capabilities: {} } })
    )
    await expect
      .poll(() => received, { timeout: 10_000 })
      .toContain('"hoverProvider":true')
    child.stdin.write(frame({ method: "initialized", params: {} }))
    child.stdin.write(frame({ id: 2, method: "shutdown" }))
    child.stdin.write(frame({ method: "exit" }))
    const code = await new Promise((resolve) => child.on("exit", resolve))
    expect(code).toBe(0)
  })

  it("writes a reply larger than the pipe whole while the editor is slow to read it", async () => {
    // Node makes a pipe non-blocking once `process.stdout` is touched; the server's writer then
    // gave up on a full pipe and the editor waited on a cut-off reply for good (0.3.6).
    const names = Array.from(
      { length: 4000 },
      (_, index) => `n${index}: "${index}px"`
    )
    const root = project({
      "package.json": '{"name":"app"}',
      "src/tokens.ts": `import { defineTokens } from "@kirana-style/core"\nexport const space = defineTokens("space", { ${names.join(", ")} })\n`,
    })
    const bin = path.join(import.meta.dirname, "../../cli/bin/kirana-style.ts")
    const child = spawn(process.execPath, [bin, "lsp"], { cwd: root })
    const frame = (message: object) => {
      const body = JSON.stringify({ jsonrpc: "2.0", ...message })
      return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    }
    let received = Buffer.alloc(0)
    const read = (chunk: Buffer) =>
      (received = Buffer.concat([received, chunk]))
    child.stdout.on("data", read)
    child.stdin.write(
      frame({ id: 1, method: "initialize", params: { capabilities: {} } })
    )
    await expect
      .poll(() => received.toString(), { timeout: 10_000 })
      .toContain('"hoverProvider":true')
    received = Buffer.alloc(0)
    child.stdin.write(frame({ method: "initialized", params: {} }))
    child.stdin.write(
      frame({ id: 2, method: "workspace/symbol", params: { query: "" } })
    )
    // A busy editor: nothing is read while the server writes far more than a pipe holds.
    child.stdout.off("data", read)
    child.stdout.pause()
    await new Promise((resolve) => setTimeout(resolve, 1500))
    child.stdout.on("data", read)
    child.stdout.resume()
    const whole = () => {
      const header = received.indexOf("\r\n\r\n")
      if (header < 0) return false
      const length = Number(
        /Content-Length: (\d+)/.exec(
          received.subarray(0, header).toString()
        )![1]
      )
      return received.length - header - 4 >= length
    }
    await expect.poll(whole, { timeout: 15_000 }).toBe(true)
    expect(received.length).toBeGreaterThan(256 * 1024)
    const body = received.subarray(received.indexOf("\r\n\r\n") + 4).toString()
    expect(JSON.parse(body).result).toHaveLength(4000)
    child.stdin.write(frame({ id: 3, method: "shutdown" }))
    child.stdin.write(frame({ method: "exit" }))
    const code = await new Promise((resolve) => child.on("exit", resolve))
    expect(code).toBe(0)
  }, 40_000)
})
