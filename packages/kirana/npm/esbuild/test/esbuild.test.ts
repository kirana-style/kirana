import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import * as esbuild from "esbuild"
import { afterAll, describe, expect, it, vi } from "vitest"

import kirana from "../src/index.ts"

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

const MAIN = `import "@kirana-style/core/stylesheet.css"
import { css } from "@kirana-style/core"
import { space } from "./tokens.ts"
import { plain } from "./plain.js"
import { comment } from "./comment.js"
const card = css({ display: "grid", gap: space[4] })
document.body.className = String(card) + plain + comment
`
const FILES = {
  "src/main.tsx": MAIN,
  "src/tokens.ts":
    'import { defineTokens } from "@kirana-style/core"\nexport const space = defineTokens("space", { 4: "1rem" })\n',
  "src/plain.js": "export const plain = 1\n",
  "src/comment.js":
    "// @kirana-style/ in a comment only\nexport const comment = 2\n",
}

const options = (root: string) => ({
  entryPoints: [path.join(root, "src/main.tsx")],
  bundle: true,
  absWorkingDir: root,
  outdir: path.join(root, "out"),
  logLevel: "silent" as const,
  plugins: [
    kirana({ root, driver: { importModule: (url: string) => import(url) } }),
  ],
})

describe("KRN-INT-003 esbuild", () => {
  it("compiles modules and finishes the written stylesheet", async () => {
    const root = project(FILES)
    await esbuild.build({ ...options(root), minify: true })
    const css = readFileSync(path.join(root, "out/main.css"), "utf8")
    expect(css).toContain("display:grid")
    expect(css).toContain("gap:1rem")
    expect(css).not.toContain("kirana-placeholder")
    expect(readFileSync(path.join(root, "out/main.js"), "utf8")).toContain(
      "k5O_"
    )
  })

  it("finishes the stylesheet in memory when esbuild does not write", async () => {
    const root = project(FILES)
    const result = await esbuild.build({ ...options(root), write: false })
    const css = result.outputFiles.find((file) => file.path.endsWith(".css"))!
    expect(css.text).toContain("display: grid;")
    expect(new TextDecoder().decode(css.contents)).toBe(css.text)
  })

  it("warns, fails on errors, and leaves other packages alone", async () => {
    const root = project({
      ...FILES,
      "src/plain.js":
        'import { css } from "@kirana-style/core"\nexport const plain = css({ color: { "[data-a]": "red", "[data-b]": "blue" } })\n',
      "node_modules/lib/index.js":
        'import "@kirana-style/core"\nexport const lib = 1\n',
    })
    writeFileSync(
      path.join(root, "src/main.tsx"),
      MAIN + 'import { lib } from "lib"\nconsole.log(lib)\n'
    )
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await esbuild.build(options(root))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ambiguous-precedence")
    )
    warn.mockRestore()
    writeFileSync(
      path.join(root, "src/plain.js"),
      'import { css } from "@kirana-style/core"\nexport const plain = css({ colour: "red" })\n'
    )
    await expect(esbuild.build(options(root))).rejects.toThrow(
      "unknown-property"
    )
  })

  it("in watch and serve, reloads the entry with the live stylesheet", async () => {
    const root = project(FILES)
    const context = await esbuild.context(options(root))
    try {
      await context.rebuild()
      // The live file changed after the first build, so the second reloads the entry from it.
      await context.rebuild()
      const css = readFileSync(path.join(root, "out/main.css"), "utf8")
      expect(css).toContain("display: grid;")
      expect(css).not.toContain("kirana-placeholder")
    } finally {
      await context.dispose()
    }
  })

  it("resolves outputs from the working directory, and skips CSS without the placeholder", async () => {
    const root = project({ ...FILES, "src/plain.css": ".plain{}" })
    const { absWorkingDir: _, ...rest } = options(root)
    await esbuild.build({
      ...rest,
      entryPoints: [
        path.join(root, "src/main.tsx"),
        path.join(root, "src/plain.css"),
      ],
    })
    expect(readFileSync(path.join(root, "out/plain.css"), "utf8")).toContain(
      ".plain"
    )
    expect(readFileSync(path.join(root, "out/main.css"), "utf8")).toContain(
      "display: grid;"
    )
  })

  it("defaults the root to the working directory, and leaves other stylesheets alone", async () => {
    const root = project({
      ...FILES,
      "src/other/stylesheet.css": ".other{}",
    })
    writeFileSync(
      path.join(root, "src/main.tsx"),
      MAIN + 'import "./other/stylesheet.css"\n'
    )
    // No `root`: the working directory's `@kirana-style/core` is the same file the project imports.
    await esbuild.build({
      ...options(root),
      plugins: [
        kirana({ driver: { importModule: (url: string) => import(url) } }),
      ],
    })
    const css = readFileSync(path.join(root, "out/main.css"), "utf8")
    expect(css).toContain(".other")
    expect(css).toContain("display: grid;")
  })
})
