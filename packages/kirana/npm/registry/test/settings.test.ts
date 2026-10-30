import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import {
  KIRANA_REGISTRY,
  loadSettings,
  SettingsError,
} from "../src/settings.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project with these files. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-settings-"))
  created.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

/** Node's own `import()`: the compiler's default loader needs a runtime that vitest's isolation hides. */
const load = (url: string) => import(url)

describe("KRN-DX-026 a project's registries", () => {
  it("are @kirana's alone without a configuration, read from the working directory", async () => {
    const root = project({})
    const settings = await loadSettings(root)
    expect(settings).toMatchObject({ root, file: undefined })
    expect([...settings.registries.values()]).toEqual([
      { namespace: "@kirana", template: KIRANA_REGISTRY, headers: {} },
    ])
  })

  it("are read from the nearest kirana.config above, as templates or with headers", async () => {
    const root = project({
      "kirana.config.json": JSON.stringify({
        ui: {
          framework: "react",
          registries: {
            "@acme": "https://acme.dev/r/{name}.json",
            "@private": {
              url: "https://private.dev/r/{name}.json",
              headers: { Authorization: "Bearer ${TOKEN}" },
            },
            "@kirana": "public/r/{name}.json",
            "@open": { url: "https://open.dev/r/{name}.json" },
          },
        },
      }),
      "src/app/.keep": "",
    })
    const settings = await loadSettings(path.join(root, "src/app"))
    expect(settings.root).toBe(root)
    expect(settings.file).toBe(path.join(root, "kirana.config.json"))
    expect(Object.fromEntries(settings.registries)).toEqual({
      "@kirana": {
        namespace: "@kirana",
        template: "public/r/{name}.json",
        headers: {},
      },
      "@acme": {
        namespace: "@acme",
        template: "https://acme.dev/r/{name}.json",
        headers: {},
      },
      "@private": {
        namespace: "@private",
        template: "https://private.dev/r/{name}.json",
        headers: { Authorization: "Bearer ${TOKEN}" },
      },
      "@open": {
        namespace: "@open",
        template: "https://open.dev/r/{name}.json",
        headers: {},
      },
    })
  })

  it("are read from a module with the compiler's loader, and a configuration without ui has none", async () => {
    const withModule = project({
      "kirana.config.mjs":
        'export default { ui: { registries: { "@acme": "https://acme.dev/{name}.json" } } }',
    })
    expect((await loadSettings(withModule, load)).registries.has("@acme")).toBe(
      true
    )
    const without = project({ "kirana.config.json": "{}" })
    expect([...(await loadSettings(without)).registries.keys()]).toEqual([
      "@kirana",
    ])
  })

  it("keep every design when ui.allDesigns says so, and only then (KF-080)", async () => {
    const all = project({
      "kirana.config.json": JSON.stringify({ ui: { allDesigns: true } }),
    })
    expect((await loadSettings(all)).allDesigns).toBe(true)
    const off = project({
      "kirana.config.json": JSON.stringify({ ui: { allDesigns: false } }),
    })
    expect("allDesigns" in (await loadSettings(off))).toBe(false)
    const wrong = project({
      "kirana.config.json": JSON.stringify({ ui: { allDesigns: "yes" } }),
    })
    const error = await loadSettings(wrong).catch((caught: unknown) => caught)
    expect((error as Error).message).toBe(
      `${path.join(wrong, "kirana.config.json")}: ui/allDesigns must be a boolean`
    )
  })

  it("are checked before anything is fetched, every problem named", async () => {
    const root = project({
      "kirana.config.json": JSON.stringify({
        ui: {
          registries: {
            acme: "https://acme.dev/r/card.json",
            "@a": "https://a.dev/r/card.json",
            "@b": { headers: { "Bad Header": "x" } },
            "@c": 5,
          },
        },
      }),
    })
    const error = await loadSettings(root).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(SettingsError)
    const file = path.join(root, "kirana.config.json")
    expect((error as Error).message.split("\n")).toEqual([
      `${file}: ui/registries/acme is not allowed here`,
      `${file}: ui/registries/@a must match \\{name\\}`,
      `${file}: ui/registries/@b/url is required`,
      `${file}: ui/registries/@b/headers/Bad Header is not allowed here`,
      `${file}: ui/registries/@c must be a string or an object`,
    ])
  })
})
