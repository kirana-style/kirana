import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { stylesheetPath, PLACEHOLDER } from "@kirana-style/compiler/host"
import { afterAll, describe, expect, it, vi } from "vitest"

import kirana from "../src/index.ts"
import type { PluginBuilder } from "../src/index.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project next to the tests, so `@kirana-style/core` resolves from the workspace. */
function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  created.push(root)
  writeFileSync(
    path.join(root, "package.json"),
    '{"name":"app","type":"module"}'
  )
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

/** Runs the plugin's hooks the way `Bun.build` (or, `serve`, the dev server) would. */
function builder(minify = false, serve = false) {
  const loads: [RegExp, (args: { path: string }) => unknown][] = []
  const resolves: [RegExp, (args: { path: string }) => unknown][] = []
  let end: (result: { outputs: { path: string }[] }) => unknown = () => {}
  const build: PluginBuilder = {
    config: serve ? {} : { minify, entrypoints: ["src/main.tsx"] },
    onResolve: (options, resolve) =>
      void resolves.push([options.filter, resolve]),
    onLoad: (options, load) => void loads.push([options.filter, load]),
    onEnd: (hook) => void (end = hook),
  }
  return {
    build,
    resolve: (specifier: string) =>
      resolves.find(([filter]) => filter.test(specifier))?.[1]({
        path: specifier,
      }) as { path: string } | undefined,
    load: async (file: string) => {
      for (const [filter, load] of loads) {
        if (!filter.test(file)) continue
        const answer = await load({ path: file })
        if (answer !== undefined) return answer
      }
      return undefined
    },
    end: (outputs: string[]) =>
      end({ outputs: outputs.map((file) => ({ path: file })) }),
  }
}

describe("KRN-INT-003 Bun bundler", () => {
  it("compiles modules, falls through for the rest, and finishes the stylesheet", async () => {
    const root = project({
      "src/main.tsx":
        'import { css } from "@kirana-style/core"\nexport const App = () => <p sx={css({ display: "grid" })} />\n',
      "src/tokens.ts":
        'import { defineTokens } from "@kirana-style/core"\nexport const space = defineTokens("space", { 4: "1rem" })\n',
      "src/plain.js":
        "// @kirana-style/ in a comment only\nexport const x = 1\n",
      "src/other.js": "export const y = 2\n",
      "node_modules/lib/index.js": 'import "@kirana-style/core"\n',
      "dist/main.css": `a{}\n${PLACEHOLDER}\n`,
      "dist/other.css": "b{}\n",
    })
    const { build, load, end } = builder()
    kirana({ root }).setup(build)

    const main = (await load(path.join(root, "src/main.tsx"))) as {
      contents: string
      loader: string
    }
    expect(main.loader).toBe("tsx")
    expect(main.contents).toContain("k5O_")
    expect(
      ((await load(path.join(root, "src/tokens.ts"))) as { loader: string })
        .loader
    ).toBe("ts")
    expect(await load(path.join(root, "src/plain.js"))).toBeUndefined()
    expect(await load(path.join(root, "src/other.js"))).toBeUndefined()
    expect(
      await load(path.join(root, "node_modules/lib/index.js"))
    ).toBeUndefined()
    expect(await load(stylesheetPath(root))).toEqual({
      contents: PLACEHOLDER,
      loader: "css",
    })
    expect(await load(path.join(root, "src/stylesheet.css"))).toBeUndefined()

    await end([
      path.join(root, "dist/main.js"),
      path.join(root, "dist/main.css"),
      path.join(root, "dist/other.css"),
      path.join(root, "dist/missing.css"),
    ])
    const css = readFileSync(path.join(root, "dist/main.css"), "utf8")
    expect(css).toContain("display: grid;")
    expect(css).not.toContain("kirana-placeholder")
    expect(readFileSync(path.join(root, "dist/other.css"), "utf8")).toBe(
      "b{}\n"
    )
  })

  it("minifies with the build, warns, and fails on errors", async () => {
    const root = project({
      "src/a.js":
        'import { css } from "@kirana-style/core"\nexport const a = css({ color: { "[data-a]": "red", "[data-b]": "blue" } })\n',
      "src/b.js":
        'import { css } from "@kirana-style/core"\nexport const b = css({ colour: "red" })\n',
      "dist/main.css": PLACEHOLDER,
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { build, load, end } = builder(true)
    kirana({ root, reportInfo: true }).setup(build)
    expect(
      ((await load(path.join(root, "src/a.js"))) as { loader: string }).loader
    ).toBe("js")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ambiguous-precedence")
    )
    await expect(load(path.join(root, "src/b.js"))).rejects.toThrow(
      "unknown-property"
    )
    await end([path.join(root, "dist/main.css")])
    expect(readFileSync(path.join(root, "dist/main.css"), "utf8")).toContain(
      "{color:red}"
    )
    warn.mockRestore()
  })

  it("in the dev server, resolves the stylesheet to a live file it keeps current", async () => {
    const root = project({
      "src/a.js":
        'import { css } from "@kirana-style/core"\nexport const a = css({ order: 3 })\n',
    })
    const { build, resolve, load } = builder(false, true)
    kirana({ root, driver: { importModule: (url) => import(url) } }).setup(
      build
    )
    const live = resolve("@kirana-style/core/stylesheet.css")!.path
    expect(readFileSync(live, "utf8")).toBe("")
    expect(resolve("./other.css")).toBeUndefined()
    await load(path.join(root, "src/a.js"))
    expect(readFileSync(live, "utf8")).toContain("order: 3")
    // Unchanged styles leave the file alone.
    await load(path.join(root, "src/a.js"))
  })

  it("defaults the root to the working directory", () => {
    const { build } = builder()
    expect(() => kirana().setup(build)).not.toThrow()
  })
})
