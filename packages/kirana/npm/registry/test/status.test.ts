import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"
import type { Item, RegistryFile } from "../src/types.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-status-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const file = (where: string, content: string): RegistryFile => ({
  path: where,
  type: "lib",
  content,
  hash: hashOf(content),
})

const item = (version: string, files: RegistryFile[]): Item => ({
  name: "util",
  type: "lib",
  version,
  files,
})

const V1 = item("1.0.0", [
  file("util/a.ts", "export const a = 1\n"),
  file("util/b.ts", "export const b = 1\n"),
])

/** A project with `@acme/util` installed at V1, and the registry then holding `next`. */
async function installed(next?: Item) {
  const cwd = mkdtempSync(path.join(root, "project-"))
  const write = (name: string, text: string) => {
    mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true })
    writeFileSync(path.join(cwd, name), text)
  }
  write("package.json", "{}")
  write(
    "tsconfig.json",
    '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }'
  )
  write(
    "kirana.config.json",
    '{ "ui": { "registries": { "@acme": "acme/{name}.json" } } }'
  )
  write("acme/util.json", JSON.stringify(V1))
  expect((await run(cwd, "add", "@acme/util", "--no-check")).code).toBe(0)
  if (next) write("acme/util.json", JSON.stringify(next))
  return { cwd, write }
}

async function run(cwd: string, ...argv: string[]) {
  let text = ""
  const code = await main(argv, cwd, (chunk) => void (text += chunk), {
    run: () => 0,
  })
  return { code, text }
}

describe("KRN-DX-030 kirana-style ui outdated and diff", () => {
  it("say every item is up to date, and the files as installed", async () => {
    const { cwd } = await installed()
    expect(await run(cwd, "outdated")).toEqual({
      code: 0,
      text: "1 item(s), all up to date\n",
    })
    expect(await run(cwd, "diff")).toEqual({
      code: 0,
      text: "1 item(s), no differences\n",
    })
    // The project's own edit, the registry unchanged: shown, and not outdated.
    writeFileSync(
      path.join(cwd, "src/lib/util/a.ts"),
      "export const a = 'mine'\n"
    )
    expect((await run(cwd, "diff")).text).toContain(
      "@acme/util: src/lib/util/a.ts: the project changed it\n"
    )
    expect((await run(cwd, "outdated")).code).toBe(0)
  })

  it("tell a registry's new version from a change under the same version", async () => {
    const changed = item("1.1.0", [
      file("util/a.ts", "export const a = 2\n"),
      file("util/c.ts", "export const c = 1\n"),
    ])
    const { cwd } = await installed(changed)
    expect(await run(cwd, "outdated")).toEqual({
      code: 1,
      text: "@acme/util 1.0.0 → 1.1.0 (3 file(s) changed)\n",
    })
    const { cwd: inPlace } = await installed({ ...changed, version: "1.0.0" })
    expect((await run(inPlace, "outdated", "@acme/util")).text).toBe(
      "@acme/util 1.0.0: 3 file(s) changed under the same version, which update refuses\n"
    )
    const versionOnly = await installed({ ...V1, version: "1.0.1" })
    expect((await run(versionOnly.cwd, "outdated")).text).toBe(
      "@acme/util 1.0.0 → 1.0.1\n"
    )
  })

  it("show what the registry and the project changed, as lines", async () => {
    const changed = item("1.1.0", [
      file("util/a.ts", "export const a = 2\n"),
      file("util/c.ts", "export const c = 1\n"),
    ])
    const { cwd, write } = await installed(changed)
    write("src/lib/util/b.ts", "export const b = 'mine'\n")
    const { code, text } = await run(cwd, "diff")
    expect(code).toBe(0)
    expect(text).toContain(
      "@acme/util: src/lib/util/a.ts: the registry changed it\n--- src/lib/util/a.ts\n- export const a = 1\n+ export const a = 2\n"
    )
    expect(text).toContain(
      "@acme/util: src/lib/util/c.ts: the registry added it\n+++ src/lib/util/c.ts (new)\n+ export const c = 1\n+\n"
    )
    expect(text).toContain(
      "@acme/util: src/lib/util/b.ts: the registry removed it, the project changed it\n"
    )
    // A file of the project's own where the registry now adds one.
    write("src/lib/util/c.ts", "export const c = 'mine'\n")
    expect((await run(cwd, "diff")).text).toContain(
      "src/lib/util/c.ts: the registry added it, the project changed it\n"
    )
    unlinkSync(path.join(cwd, "src/lib/util/a.ts"))
    expect((await run(cwd, "diff")).text).toContain(
      "src/lib/util/a.ts: the registry changed it, the project removed it\n"
    )
  })

  it("read an item again for the framework and base it was installed with", async () => {
    const marked = (version: string, content: string): Item => ({
      name: "util",
      type: "component",
      version,
      frameworks: {
        react: {
          base: { files: [file("util/a.tsx", content)] },
          aria: { files: [file("util/a.tsx", "aria\n")] },
        },
      },
    })
    const cwd = mkdtempSync(path.join(root, "project-"))
    for (const [name, text] of Object.entries({
      "package.json": '{ "dependencies": { "react": "19" } }',
      "tsconfig.json":
        '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
      "kirana.config.json":
        '{ "ui": { "base": "base", "registries": { "@acme": "acme/{name}.json" } } }',
      "acme/util.json": JSON.stringify(marked("1.0.0", "base\n")),
    })) {
      mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true })
      writeFileSync(path.join(cwd, name), text)
    }
    expect((await run(cwd, "add", "@acme/util", "--no-check")).code).toBe(0)
    writeFileSync(
      path.join(cwd, "acme/util.json"),
      JSON.stringify(marked("2.0.0", "base, again\n"))
    )
    expect((await run(cwd, "diff")).text).toContain("+ base, again\n")
  })

  it("name an item that is not installed or cannot be read, and stop on settings they cannot use", async () => {
    const { cwd, write } = await installed()
    expect(await run(cwd, "outdated", "@acme/other")).toEqual({
      code: 1,
      text: "@acme/other: is not installed (kirana-style.lock.json)\n",
    })
    write("acme/util.json", "{")
    expect((await run(cwd, "diff", "util")).code).toBe(1)
    expect((await run(cwd, "diff", "--all")).text).toBe(
      "kirana-style ui diff: unknown option --all\n"
    )
    expect((await run(cwd, "outdated", "--all")).code).toBe(2)
    write("kirana-style.lock.json", "{")
    for (const command of ["outdated", "diff"])
      expect((await run(cwd, command)).code).toBe(2)
    expect(readFileSync(path.join(cwd, "src/lib/util/a.ts"), "utf8")).toBe(
      "export const a = 1\n"
    )
  })
})
