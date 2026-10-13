import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { STYLE_BEARING } from "@kirana-style/compiler/host"
import { KiranaPlugin } from "@kirana-style/webpack"
import { afterAll, describe, expect, it, vi } from "vitest"

import { LOADER, SCRIPTS, rule, withKirana } from "../src/index.ts"
import kiranaLoader, { driverFor } from "../src/loader.ts"
import type { LoaderContext } from "../src/loader.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

function project(files: Record<string, string>): string {
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

describe("KRN-INT-010 Next.js with Turbopack", () => {
  it("runs the loader on the project's own scripts that can hold styles", () => {
    const config = withKirana({}, { root: "/app" })
    expect(Object.keys(config.turbopack.rules)).toEqual(
      SCRIPTS.map((extension) => `*.${extension}`)
    )
    expect(config.turbopack.rules["*.tsx"]).toEqual({
      condition: { all: [{ not: "foreign" }, { content: STYLE_BEARING }] },
      loaders: [{ loader: LOADER, options: { root: "/app" } }],
    })
    expect(LOADER).toMatch(/loader\.ts$/)
    // The webpack half is the webpack adapter's, for `next build --webpack`.
    const webpack = config.webpack!({}, { dir: "/app" })
    expect(webpack.plugins).toEqual([expect.any(KiranaPlugin)])
  })

  it("keeps a project's own Turbopack rules and settings, and the working directory as root", () => {
    const svg = { loaders: ["@svgr/webpack"], as: "*.js" }
    const config = withKirana({
      reactStrictMode: true,
      turbopack: {
        resolveAlias: { a: "b" },
        rules: {
          "*.svg": svg,
          "*.js": "raw-loader",
          "*.ts": ["one-loader", { loader: "two" }],
        },
      },
    })
    expect(config.reactStrictMode).toBe(true)
    expect(config.turbopack.resolveAlias).toEqual({ a: "b" })
    expect(config.turbopack.rules["*.svg"]).toBe(svg)
    expect(config.turbopack.rules["*.js"]).toEqual([
      "raw-loader",
      rule(process.cwd()),
    ])
    expect(config.turbopack.rules["*.ts"]).toEqual([
      "one-loader",
      { loader: "two" },
      rule(process.cwd()),
    ])
  })
})

/** Runs the loader as Turbopack would; resolves with what it called back. */
function load(
  context: Partial<LoaderContext> & { root: string; resourcePath: string },
  source: string
) {
  return new Promise<{ error: Error | null; code?: string; map?: unknown }>(
    (resolve) => {
      kiranaLoader.call(
        {
          getOptions: () => ({ root: context.root }),
          async: () => (error, code, map) => resolve({ error, code, map }),
          ...context,
        } as LoaderContext,
        source,
        "input-map"
      )
    }
  )
}

describe("the Turbopack loader", () => {
  const TOKENS = `import { defineTokens } from "@kirana-style/core"\nexport const color = defineTokens("color", { brand: { value: "#0af", variable: true } })\n`

  it("compiles a module with styles, and records what it read", async () => {
    const root = project({ "tokens.ts": TOKENS })
    const addDependency = vi.fn()
    const file = path.join(root, "card.tsx")
    const source = `import { css } from "@kirana-style/core"\nimport { color } from "./tokens"\nexport const card = css({ color: color.brand })\n`
    const { error, code, map } = await load(
      { root, resourcePath: file, addDependency },
      source
    )
    expect(error).toBeNull()
    expect(code).not.toContain("css({")
    expect(map).toEqual(expect.objectContaining({ version: 3 }))
    expect(addDependency).toHaveBeenCalledWith(path.join(root, "tokens.ts"))
    expect(driverFor(root)).toBe(driverFor(root))
  })

  it("passes a module without styles, or one the compiler leaves as it is, through unchanged", async () => {
    const root = project({})
    const plain = await load(
      { root, resourcePath: path.join(root, "a.ts") },
      "export const a = 1\n"
    )
    expect(plain).toEqual({
      error: null,
      code: "export const a = 1\n",
      map: "input-map",
    })
    const untouched = `import type { Sx } from "@kirana-style/core"\nexport type P = { sx?: Sx }\n`
    const typed = await load(
      { root, resourcePath: path.join(root, "b.ts") },
      untouched
    )
    expect(typed).toEqual({ error: null, code: untouched, map: "input-map" })
  })

  it("warns where the host can, and fails on an error", async () => {
    const root = project({})
    const emitWarning = vi.fn()
    const warning = `import { css } from "@kirana-style/core"\nexport const a = css({ color: { "[data-a]": "red", "[data-b]": "blue" } })\n`
    await load(
      { root, resourcePath: path.join(root, "w.tsx"), emitWarning },
      warning
    )
    expect(emitWarning.mock.calls[0]![0].message).toContain(
      "ambiguous-precedence"
    )
    // A host without `emitWarning` or `addDependency` is fine too.
    const quiet = await load(
      { root, resourcePath: path.join(root, "q.tsx") },
      warning.replace("[data-a]", "[data-c]")
    )
    expect(quiet.error).toBeNull()
    const failing = `import { css } from "@kirana-style/core"\nexport const a = css({ width: 5 })\n`
    const { error } = await load(
      { root, resourcePath: path.join(root, "e.tsx") },
      failing
    )
    expect(error?.message).toContain("unitless-length")
  })
})
