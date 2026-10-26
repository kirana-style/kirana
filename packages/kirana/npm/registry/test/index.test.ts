import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test"

import { hashOf, main } from "../src/index.ts"
import type { Options } from "../src/index.ts"
import { CARD, serve } from "./server.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-"))
let registry: Awaited<ReturnType<typeof serve>>
beforeAll(async () => {
  registry = await serve()
})
afterAll(async () => {
  await registry.close()
  rmSync(root, { recursive: true, force: true })
})

/** A file in the temporary directory, by name. */
function write(name: string, text: string) {
  writeFileSync(path.join(root, name), text)
  return name
}

async function run(...argv: string[]) {
  return runIn(root, {}, ...argv)
}

async function runIn(cwd: string, options: Options, ...argv: string[]) {
  let text = ""
  const code = await main(argv, cwd, (chunk) => void (text += chunk), options)
  return { code, text }
}

/** A project whose kirana.config.json names these registries. */
function project(registries: unknown): string {
  const directory = mkdtempSync(path.join(root, "project-"))
  writeFileSync(
    path.join(directory, "kirana.config.json"),
    JSON.stringify({ ui: { registries } })
  )
  return directory
}

describe("KRN-DX-020 the commands kirana-style ui runs", () => {
  it("prints its usage with no command, help, --help or -h", async () => {
    for (const argv of [[], ["help"], ["--help"], ["-h"]]) {
      const { code, text } = await run(...argv)
      expect(code).toBe(0)
      expect(text).toContain("validate <document…>")
    }
  })

  it("prints its own version", async () => {
    const { version } = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version: string }
    for (const flag of ["--version", "-v"])
      expect(await run(flag)).toEqual({
        code: 0,
        text: `@kirana-style/registry ${version}\n`,
      })
  })

  it("says a command of a later release is not in this one, and refuses an unknown one", async () => {
    expect(await run("mcp")).toEqual({
      code: 1,
      text: "kirana-style ui mcp is not in this release yet\n",
    })
    const unknown = await run("install")
    expect(unknown.code).toBe(2)
    expect(unknown.text).toMatch(
      /^kirana-style ui: unknown command install\n\nUsage/
    )
  })

  it("runs from its own bin in a folder with nothing installed (KF-035)", async () => {
    const { spawnSync } = await import("node:child_process")
    const empty = mkdtempSync(path.join(root, "empty-"))
    const bin = path.join(import.meta.dirname, "../bin/kirana-style-ui.ts")
    const version = spawnSync(process.execPath, [bin, "--version"], {
      cwd: empty,
      encoding: "utf8",
    })
    const { version: release } = JSON.parse(
      readFileSync(path.join(import.meta.dirname, "../package.json"), "utf8")
    ) as { version: string }
    expect(version.stdout).toBe(`@kirana-style/registry ${release}\n`)
    const unknown = spawnSync(process.execPath, [bin, "install"], {
      cwd: empty,
      encoding: "utf8",
    })
    expect(unknown.status).toBe(2)
  })

  it("lists every option each command takes in its help (KF-035)", async () => {
    const { text } = await run("--help")
    const source = path.join(import.meta.dirname, "../src")
    const { readdirSync } = await import("node:fs")
    for (const name of readdirSync(source)) {
      const code = readFileSync(path.join(source, name), "utf8")
      for (const call of code.matchAll(
        /parseArgs\(\s*"([a-z]+)"[\s\S]*?\)\n/g
      )) {
        const command = call[1]!
        // The command's own help entry: its line and the indented lines under it.
        const entry = new RegExp(
          `^  ${command}\\b[^\\n]*(\\n {25}[^\\n]*)*`,
          "m"
        ).exec(text)![0]
        for (const flag of call[0].match(/--[a-z-]+/g) ?? [])
          expect(`${command} ${flag}: ${entry.includes(flag)}`).toBe(
            `${command} ${flag}: true`
          )
      }
    }
  })
})

describe("KRN-DX-024 kirana-style ui validate", () => {
  it("needs a document", async () => {
    expect(await run("validate")).toEqual({
      code: 2,
      text: "kirana-style ui validate needs at least one document\n",
    })
  })

  it("names each document's kind when it is valid", async () => {
    const item = write(
      "button.json",
      JSON.stringify({
        name: "button",
        type: "component",
        version: "0.1.0",
        styles: [
          {
            path: "button.styles.ts",
            type: "ui",
            content: "",
            hash: hashOf(""),
          },
        ],
      })
    )
    const lockfile = write(
      "kirana-style.lock.json",
      '{"lockfileVersion":1,"items":{}}'
    )
    expect(await run("validate", item, lockfile)).toEqual({
      code: 0,
      text: "button.json: a valid item\nkirana-style.lock.json: a valid lockfile\n",
    })
  })

  it("reports every problem, the root as /, and exits 1", async () => {
    const index = write("index.json", '{"items":[{"name":"x"}]}')
    const text = write("text.json", '"button"')
    const { code, text: output } = await run("validate", index, text)
    expect(code).toBe(1)
    expect(output).toBe(
      [
        "index.json: /items/0/type is required",
        "index.json: /items/0/version is required",
        "text.json: / must be an object",
        "",
      ].join("\n")
    )
  })

  it("reports a file it cannot read or parse, and goes on", async () => {
    const broken = write("broken.json", "{")
    const good = write("good.json", '{"items":[]}')
    const { code, text } = await run("validate", "missing.json", broken, good)
    expect(code).toBe(1)
    const lines = text.trimEnd().split("\n")
    expect(lines[0]).toMatch(/^missing\.json: .*(ENOENT|no such file)/)
    expect(lines[1]).toMatch(/^broken\.json: /)
    expect(lines[2]).toBe("good.json: a valid index")
  })
})

describe("KRN-DX-026 kirana-style ui validate reads registries", () => {
  it("validates an item or an index of the project's registries, and @kirana's by name", async () => {
    const cwd = project({
      "@acme": `${registry.url}/r/{name}.json`,
      "@kirana": `${registry.url}/r/{name}.json`,
    })
    expect(
      await runIn(cwd, {}, "validate", "@acme/card", "card", "@acme/index")
    ).toEqual({
      code: 0,
      text: "@acme/card: a valid item\ncard: a valid item\n@acme/index: a valid index\n",
    })
  })

  it("validates a URL as it is", async () => {
    writeFileSync(path.join(root, "card-file.json"), JSON.stringify(CARD))
    const url = new URL(`file://${path.join(root, "card-file.json")}`).href
    expect(await run("validate", `${registry.url}/r/card.json`, url)).toEqual({
      code: 0,
      text: `${registry.url}/r/card.json: a valid item\n${url}: a valid item\n`,
    })
  })

  it("says what failed, and that a reference is not what it asked for", async () => {
    const cwd = project({
      "@acme": `${registry.url}/r/{name}.json`,
      "@local": "r/{name}.json",
    })
    mkdirSync(path.join(cwd, "r"))
    writeFileSync(path.join(cwd, "r/renamed.json"), JSON.stringify(CARD))
    const { code, text } = await runIn(
      cwd,
      {},
      "validate",
      "@acme/missing",
      "@nope/card",
      "@local/renamed"
    )
    expect(code).toBe(1)
    expect(text.split("\n")).toEqual([
      `@acme/missing: ${registry.url}/r/missing.json: answered 404 Not Found`,
      "@nope/card: @nope is not a registry this project knows: @kirana, @acme, @local (ui.registries in kirana.config)",
      '@local/renamed: / is the item "card", not renamed',
      "",
    ])
  })

  it("names a URL that fails once", async () => {
    expect(await run("validate", "http://acme.dev/r/card.json")).toEqual({
      code: 1,
      text: "http://acme.dev/r/card.json: only https, or http from this machine, can be fetched\n",
    })
  })

  it("reads a file whose name looks like a reference", async () => {
    write("card", "{}")
    expect(await run("validate", "card")).toEqual({
      code: 1,
      text: "card: /name is required\ncard: /type is required\ncard: /version is required\n",
    })
  })

  it("stops when the project's ui settings cannot be used", async () => {
    const cwd = project({ "@acme": "https://acme.dev/r/card.json" })
    const { code, text } = await runIn(cwd, {}, "validate", "@acme/card")
    expect(code).toBe(2)
    expect(text).toBe(
      `${path.join(cwd, "kirana.config.json")}: ui/registries/@acme must match \\{name\\}\n`
    )
    const broken = mkdtempSync(path.join(root, "broken-"))
    writeFileSync(path.join(broken, "kirana.config.mjs"), "export default {")
    const failed = await runIn(
      broken,
      { load: (url) => import(url) },
      "validate",
      "@acme/card"
    )
    expect(failed.code).toBe(2)
    expect(failed.text).toMatch(/^loading .*kirana\.config\.mjs: /)
  })
})
