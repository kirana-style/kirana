import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf, main } from "../src/index.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** A file in the temporary directory, by name. */
function write(name: string, text: string) {
  writeFileSync(path.join(root, name), text)
  return name
}

async function run(...argv: string[]) {
  let text = ""
  const code = await main(argv, root, (chunk) => void (text += chunk))
  return { code, text }
}

describe("KRN-DX-020 the commands kirana-style ui runs", () => {
  it("prints its usage with no command, help, --help or -h", async () => {
    for (const argv of [[], ["help"], ["--help"], ["-h"]]) {
      const { code, text } = await run(...argv)
      expect(code).toBe(0)
      expect(text).toContain("validate <file…>")
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
    expect(await run("add", "button")).toEqual({
      code: 1,
      text: "kirana-style ui add is not in this release yet\n",
    })
    const unknown = await run("install")
    expect(unknown.code).toBe(2)
    expect(unknown.text).toMatch(
      /^kirana-style ui: unknown command install\n\nUsage/
    )
  })
})

describe("KRN-DX-024 kirana-style ui validate", () => {
  it("needs a file", async () => {
    expect(await run("validate")).toEqual({
      code: 2,
      text: "kirana-style ui validate needs at least one file\n",
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
