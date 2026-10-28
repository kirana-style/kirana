import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it, vi } from "vite-plus/test"

import { moduleHooks, moduleTypeScript, readJsonc } from "../src/config.ts"

import {
  ConfigLoadError,
  Driver,
  findConfigAbove,
  formatDiagnostic,
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

    // The WASI engine has no worker pool here: `transformAsync` compiles on the calling thread.
    const native = loadNative()
    const wasi = {
      ...native,
      __napiBindingTarget: "wasm32-wasi",
      Compiler: class extends native.Compiler {
        override transformAsync(): never {
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
    expect(
      loadNative({
        KIRANA_NATIVE_PATH: require.resolve("../kirana.linux-x64-gnu.node"),
      })
    ).toBe(binding)
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
  it("formats with and without a file", () => {
    const base = {
      code: "KRN1403",
      name: "relation-placement",
      severity: "error" as const,
      span: { start: 4, end: 9 },
      message: "m",
    }
    expect(formatDiagnostic({ ...base, file: "a.tsx", help: ["h"] })).toBe(
      "error[KRN1403] relation-placement: m (a.tsx)\n  help: h"
    )
    // Offsets count UTF-8 bytes: `é` is two.
    expect(
      formatDiagnostic(
        { ...base, file: "a.tsx", help: [], span: { start: 5, end: 6 } },
        "ab\n\u00e9cd"
      )
    ).toBe("error[KRN1403] relation-placement: m (a.tsx:2:2)")
    expect(
      formatDiagnostic(
        { ...base, file: "a.tsx", help: [], span: { start: 0, end: 0 } },
        "abc"
      )
    ).toBe("error[KRN1403] relation-placement: m (a.tsx)")
    expect(formatDiagnostic({ ...base, file: "", help: [] })).toBe(
      "error[KRN1403] relation-placement: m"
    )
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
    // One group, the working directory's: printed as before, with no header.
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
    // A path that does not exist is looked up from its parent, and fails as it did.
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
})
