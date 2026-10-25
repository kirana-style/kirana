import {
  existsSync,
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
import { readLockfile } from "../src/lockfile.ts"
import type { Item, RegistryFile } from "../src/types.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-update-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const file = (where: string, content: string): RegistryFile => ({
  path: where,
  type: "lib",
  content,
  hash: hashOf(content),
})

const util = (
  version: string,
  files: RegistryFile[],
  extra: Partial<Item> = {}
): Item => ({
  name: "util",
  type: "lib",
  version,
  files,
  ...extra,
})

const V1 = util("1.0.0", [
  file("util/a.ts", "export const a = 1\n"),
  file("util/b.ts", "export const b = 1\n"),
])
const V2 = util("2.0.0", [
  file("util/a.ts", "export const a = 2\n"),
  file("util/c.ts", "export const c = 1\n"),
])

/** A project with these items installed from `@acme`. */
async function installed(items: Item[] = [V1], add = ["@acme/util"]) {
  const cwd = mkdtempSync(path.join(root, "project-"))
  const write = (name: string, text: string) => {
    mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true })
    writeFileSync(path.join(cwd, name), text)
  }
  write("package.json", '{ "dependencies": { "react": "19" } }')
  write(
    "tsconfig.json",
    '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }'
  )
  write(
    "kirana.config.json",
    '{ "ui": { "base": "base", "registries": { "@acme": "acme/{name}.json" } } }'
  )
  for (const item of items)
    write(`acme/${item.name}.json`, JSON.stringify(item))
  expect((await run(cwd, "add", ...add, "--no-check")).code).toBe(0)
  const publish = (item: Item) =>
    write(`acme/${item.name}.json`, JSON.stringify(item))
  return { cwd, write, publish }
}

async function run(cwd: string, ...argv: string[]) {
  let text = ""
  const commands: string[] = []
  const code = await main(argv, cwd, (chunk) => void (text += chunk), {
    run: (command) => (commands.push(command), 0),
  })
  return { code, text, commands }
}

const read = (cwd: string, name: string) =>
  readFileSync(path.join(cwd, name), "utf8")
const exists = (cwd: string, name: string) => existsSync(path.join(cwd, name))

describe("KRN-DX-031 kirana-style ui update", () => {
  it("writes what the registry changed, adds and deletes its files, and records the new version", async () => {
    const { cwd, publish } = await installed()
    expect(await run(cwd, "update")).toMatchObject({
      code: 0,
      text: "1 item(s), all up to date\n",
    })
    publish(V2)
    const { code, text } = await run(cwd, "update")
    expect(code).toBe(0)
    expect(text).toBe(
      [
        "@acme/util 1.0.0 → 2.0.0",
        "  + src/lib/util/a.ts",
        "  + src/lib/util/c.ts",
        "  - src/lib/util/b.ts",
        "kirana-style.lock.json: 1 item(s) recorded",
        "check: kirana-style check on 2 file(s)",
        "0 diagnostic(s), 0 error(s)",
        "",
      ].join("\n")
    )
    expect(read(cwd, "src/lib/util/a.ts")).toBe("export const a = 2\n")
    expect(exists(cwd, "src/lib/util/b.ts")).toBe(false)
    const locked = readLockfile(cwd).items["@acme/util"]!
    expect(locked.version).toBe("2.0.0")
    expect(Object.keys(locked.files).sort()).toEqual([
      "src/lib/util/a.ts",
      "src/lib/util/c.ts",
    ])
    expect((await run(cwd, "outdated")).code).toBe(0)
  })

  it("keeps what the project changed, and stops where both sides changed a file", async () => {
    const { cwd, write, publish } = await installed([
      util("1.0.0", [...V1.files!, file("util/d.ts", "export const d = 1\n")]),
    ])
    write("src/lib/util/a.ts", "export const a = 'mine'\n")
    write("src/lib/util/b.ts", "export const b = 'mine'\n")
    write("src/lib/util/d.ts", "export const d = 'mine'\n")
    publish(
      util("2.0.0", [
        file("util/a.ts", "export const a = 2\n"),
        file("util/d.ts", "export const d = 1\n"),
      ])
    )
    const stopped = await run(cwd, "update", "--no-check")
    expect(stopped.code).toBe(1)
    expect(stopped.text).toContain(
      "  ! src/lib/util/a.ts: you and the registry both changed it\n"
    )
    expect(stopped.text).toContain(
      "  ~ src/lib/util/b.ts: no longer the item's; yours, kept\n"
    )
    expect(stopped.text).toContain("  ~ src/lib/util/d.ts: yours, kept\n")
    expect(stopped.text).toMatch(
      /1 file\(s\) changed on both sides: nothing written; kirana-style ui diff shows them, --overwrite takes the registry's\n$/
    )
    expect(read(cwd, "src/lib/util/a.ts")).toBe("export const a = 'mine'\n")
    const taken = await run(cwd, "update", "--overwrite", "--no-check")
    expect(taken.code).toBe(0)
    expect(read(cwd, "src/lib/util/a.ts")).toBe("export const a = 2\n")
    expect(read(cwd, "src/lib/util/b.ts")).toBe("export const b = 'mine'\n")
    // The project's own edit, the registry's file unchanged: still recorded as installed.
    expect(
      readLockfile(cwd).items["@acme/util"]!.files["src/lib/util/d.ts"]
    ).toBeDefined()
  })

  it("installs what an update newly needs, with its packages, and writes nothing on a dry run", async () => {
    const helper: Item = {
      name: "helper",
      type: "component",
      version: "1.0.0",
      frameworks: {
        react: {
          base: {
            files: [file("helper.ts", "export const helper = 1\n")],
            dependencies: { "left-pad": "^1.3.0" },
          },
        },
      },
    }
    const plain: Item = {
      name: "plain",
      type: "lib",
      version: "1.0.0",
      files: [file("plain.ts", "export {}\n")],
    }
    const { cwd, publish } = await installed()
    publish(helper)
    publish(plain)
    publish(
      util("2.0.0", V1.files!, { registryDependencies: ["helper", "plain"] })
    )
    const dry = await run(cwd, "update", "--dry-run")
    expect(dry.text).toContain(
      "@acme/helper 1.0.0: newly needed\n  + src/lib/helper.ts\n"
    )
    expect(dry.text).toContain("packages: npm install left-pad@^1.3.0\n")
    expect(dry.text).toMatch(/dry run: nothing written\n$/)
    expect(dry.commands).toEqual([])
    expect(exists(cwd, "src/lib/helper.ts")).toBe(false)
    const { code, commands } = await run(cwd, "update", "--no-check")
    expect(code).toBe(0)
    expect(commands).toEqual(["npm install left-pad@^1.3.0"])
    expect(readLockfile(cwd).items["@acme/helper"]).toMatchObject({
      version: "1.0.0",
      framework: "react",
      base: "base",
    })
    // The helper, installed with its base, updates with its base's packages.
    publish({ ...helper, version: "1.1.0" })
    expect(
      (await run(cwd, "update", "@acme/helper", "--no-check")).commands
    ).toEqual(["npm install left-pad@^1.3.0"])
  })

  it("leaves a file the registry removed that the project had removed already", async () => {
    const { cwd, publish } = await installed()
    unlinkSync(path.join(cwd, "src/lib/util/b.ts"))
    publish(V2)
    const { code, text } = await run(cwd, "update", "--no-check")
    expect(code).toBe(0)
    expect(text).not.toContain("b.ts")
    expect(await run(cwd, "outdated", "nope")).toMatchObject({
      code: 1,
      text: "@kirana/nope: is not installed (kirana-style.lock.json)\n",
    })
  })

  it("refuses a change under the same version, and stops on what it cannot read, install or check", async () => {
    const { cwd, publish, write } = await installed()
    publish({ ...V2, version: "1.0.0" })
    const refused = await run(cwd, "update")
    expect(refused).toMatchObject({
      code: 1,
      text: "@acme/util 1.0.0: the registry changed its files without a new version; refused (KRN-DX-025)\n",
    })
    expect((await run(cwd, "update", "@acme/other")).code).toBe(1)
    publish(util("3.0.0", V1.files!, { registryDependencies: ["missing"] }))
    expect((await run(cwd, "update")).text).toMatch(/missing\.json/)
    publish(
      util("3.0.0", [
        file(
          "util/a.ts",
          'import { css } from "@kirana-style/core"\nexport const a = css({ colour: "red" })\n'
        ),
      ])
    )
    const unchecked = await run(cwd, "update")
    expect(unchecked.code).toBe(1)
    expect(unchecked.text).toContain("unknown-property")
    publish(util("4.0.0", V1.files!, { dependencies: { "left-pad": "1" } }))
    let text = ""
    expect(
      await main(
        ["update", "--no-check"],
        cwd,
        (chunk) => void (text += chunk),
        {
          run: () => 1,
        }
      )
    ).toBe(1)
    expect(text).toMatch(
      /failed: the files are written, the lockfile is not\n$/
    )
    expect((await run(cwd, "update", "--all")).code).toBe(2)
    write("kirana-style.lock.json", "{")
    expect((await run(cwd, "update")).code).toBe(2)
  })

  it("reports an item it cannot read beside the ones it updates", async () => {
    const other: Item = {
      ...V1,
      name: "other",
      files: [file("other.ts", "export {}\n")],
    }
    const { cwd, publish, write } = await installed(
      [V1, other],
      ["@acme/util", "@acme/other"]
    )
    publish(V2)
    write("acme/other.json", "{")
    const { code, text } = await run(cwd, "update", "--no-check")
    expect(code).toBe(1)
    expect(text).toContain("@acme/util 1.0.0 → 2.0.0")
    expect(text).toMatch(/^@acme\/other: /m)
  })
})

describe("KRN-DX-031 kirana-style ui remove", () => {
  it("deletes the files left as installed, keeps the project's own edits, and forgets the item", async () => {
    const { cwd, write } = await installed()
    write("src/lib/util/b.ts", "export const b = 'mine'\n")
    const dry = await run(cwd, "remove", "util", "--dry-run")
    expect(dry.text).toMatch(/dry run: nothing removed\n$/)
    expect(exists(cwd, "src/lib/util/a.ts")).toBe(true)
    unlinkSync(path.join(cwd, "src/lib/util/a.ts"))
    write("src/lib/util/a.ts", "export const a = 1\n")
    const { code, text } = await run(cwd, "remove", "@acme/util")
    expect(code).toBe(0)
    expect(text).toBe(
      [
        "@acme/util",
        "  - src/lib/util/a.ts",
        "  ~ src/lib/util/b.ts: yours, kept",
        "kirana-style.lock.json: 1 item(s) removed",
        "",
      ].join("\n")
    )
    expect(exists(cwd, "src/lib/util/a.ts")).toBe(false)
    expect(read(cwd, "src/lib/util/b.ts")).toBe("export const b = 'mine'\n")
    expect(readLockfile(cwd).items).toEqual({})
  })

  it("skips a file the project removed already, and removes an item nothing needs beside one that needs another", async () => {
    const user: Item = {
      ...V1,
      name: "user",
      files: [file("user.ts", "export {}\n")],
      registryDependencies: ["util"],
    }
    const lone: Item = {
      ...V1,
      name: "lone",
      files: [file("lone.ts", "export {}\n")],
    }
    const { cwd } = await installed(
      [V1, user, lone],
      ["@acme/user", "@acme/lone"]
    )
    unlinkSync(path.join(cwd, "src/lib/lone.ts"))
    expect(await run(cwd, "remove", "lone")).toMatchObject({
      code: 0,
      text: "@acme/lone\nkirana-style.lock.json: 1 item(s) removed\n",
    })
  })

  it("refuses an item another installed item needs, or one not installed", async () => {
    const user: Item = {
      name: "user",
      type: "component",
      version: "1.0.0",
      frameworks: {
        react: {
          base: {
            files: [file("user.ts", "export {}\n")],
            registryDependencies: ["util"],
          },
        },
      },
    }
    const { cwd, write } = await installed([V1, user], ["@acme/user"])
    expect(await run(cwd, "remove", "util")).toMatchObject({
      code: 1,
      text: "@acme/user needs @acme/util\nnothing removed\n",
    })
    const full = await installed(
      [
        V1,
        {
          ...V1,
          name: "user2",
          files: [file("user2.ts", "export {}\n")],
          registryDependencies: ["@acme/util"],
        },
      ],
      ["@acme/user2"]
    )
    expect((await run(full.cwd, "remove", "util")).text).toBe(
      "@acme/user2 needs @acme/util\nnothing removed\n"
    )
    expect(await run(cwd, "remove", "@acme/nope")).toMatchObject({
      code: 1,
      text: "@acme/nope: not installed (kirana-style.lock.json)\n",
    })
    write("acme/user.json", "{")
    expect((await run(cwd, "remove", "util")).text).toMatch(/^@acme\/user: /)
    expect((await run(cwd, "remove")).code).toBe(2)
    expect((await run(cwd, "remove", "--force", "util")).code).toBe(2)
    write("kirana-style.lock.json", "{")
    expect((await run(cwd, "remove", "util")).code).toBe(2)
  })
})
