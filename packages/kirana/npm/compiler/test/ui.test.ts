import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { main } from "../src/cli.ts"
import { resolveConfigFile } from "../src/config.ts"
import { runUi } from "../src/ui.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project in the temporary directory, with an installed `@kirana-style/registry` if given. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "kirana-ui-"))
  created.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

/** `@kirana-style/registry` installed in a project, with `index.js` as its entry. */
const registry = (index: string) => ({
  "package.json": JSON.stringify({ name: "app" }),
  "node_modules/@kirana-style/registry/package.json": JSON.stringify({
    name: "@kirana-style/registry",
    type: "module",
    exports: { ".": "./index.js" },
  }),
  "node_modules/@kirana-style/registry/index.js": index,
})

/** Node's own `import()`: the CLI's default loader needs a runtime that vitest's isolation hides. */
const load = (url: string) => import(url)

function capture() {
  const out = { text: "" }
  return { out, write: (text: string) => void (out.text += text) }
}

describe("KRN-DX-020 kirana-style ui", () => {
  it("hands the arguments after `ui` to the project's @kirana-style/registry", async () => {
    const root = project(
      registry(
        "export async function main(argv, cwd, write) { write(JSON.stringify(argv)); return 3 }"
      )
    )
    const { out, write } = capture()
    expect(await runUi(["add", "button"], root, write, load)).toBe(3)
    expect(out.text).toBe('["add","button"]')
  })

  it("says so when the project does not have it", async () => {
    const root = project({ "package.json": JSON.stringify({ name: "app" }) })
    const { out, write } = capture()
    expect(await main(["ui", "add", "button"], root, write)).toBe(1)
    expect(out.text).toBe(
      "kirana-style ui needs @kirana-style/registry, which this project does not have: add it as a development dependency, or start a new project with npx @kirana-style/registry init --template <example> <directory>\n"
    )
  })

  it("passes on why it failed to load, as the placeholder's own message", async () => {
    const root = project(
      registry(
        'throw new Error("@kirana-style/registry@0.0.0 is a placeholder. Install @kirana-style/registry@latest.\\nat index.js")'
      )
    )
    const { out, write } = capture()
    expect(await runUi([], root, write, load)).toBe(1)
    expect(out.text).toBe(
      "loading @kirana-style/registry: @kirana-style/registry@0.0.0 is a placeholder. Install @kirana-style/registry@latest.\n"
    )
    const thrown = capture()
    expect(
      await runUi([], root, thrown.write, () => Promise.reject("not a module"))
    ).toBe(1)
    expect(thrown.out.text).toBe(
      "loading @kirana-style/registry: not a module\n"
    )
  })

  it("refuses a version that exports no main()", async () => {
    const root = project(registry("export const version = '0.0.1'"))
    const { out, write } = capture()
    expect(await runUi([], root, write, load)).toBe(1)
    expect(out.text).toContain("exports no main()")
  })
})

describe("KRN-DX-020 the ui key in kirana.config", () => {
  it("never reaches the engine, which refuses keys it does not know", async () => {
    const root = project({
      "package.json": JSON.stringify({ name: "app" }),
      "kirana.config.json": JSON.stringify({
        names: { prefix: "q" },
        ui: { framework: "react", preset: "k0" },
      }),
      "src/a.ts": "export const a = 1\n",
    })
    const { json } = await resolveConfigFile(
      path.join(root, "kirana.config.json")
    )
    const engine = JSON.parse(json) as Record<string, unknown>
    expect(engine.ui).toBeUndefined()
    expect(engine.names).toEqual({ prefix: "q" })
    const { out, write } = capture()
    expect(await main(["check", "src"], root, write)).toBe(0)
    expect(out.text).not.toContain("unknown field")
  })
})
