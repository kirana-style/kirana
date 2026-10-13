import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vitest"

import { main } from "../src/cli.ts"
import { loadNative } from "../src/native.ts"
import type { Report } from "../src/report.ts"
import { collect, markdown, redact, runReport } from "../src/report.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "kirana-report-"))
  created.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

const native = loadNative()
const load = () => native

const STYLE = `import { css, firstThatWorks } from "@kirana-style/core"
export const box = css({
  minHeight: firstThatWorks("100dvh", "100vh"),
  colour: "red",
})
`

/** A project that is set up, with a style and one diagnostic. */
const setUp = () =>
  project({
    "package.json": JSON.stringify({
      name: "app",
      dependencies: {
        "@kirana-style/core": "0",
        "@kirana-style/compiler": "0",
      },
    }),
    "kirana.config.json": `{ "names": { "prefix": "q" } }`,
    "node_modules/@kirana-style/core/package.json": `{"version":"0.1.0"}`,
    "node_modules/@kirana-style/compiler/package.json": `{"version":"0.1.0"}`,
    "src/box.tsx": STYLE,
  })

describe("KRN-DX-008 kirana doctor --report", () => {
  it("writes a redacted issue body with the engine's findings", async () => {
    const root = setUp()
    let output = ""
    const code = await runReport(
      ["--report", "--trace", "src/box.tsx:3", "minHeight"],
      root,
      (text) => (output += text),
      load,
      { home: path.dirname(root), user: "kirana-report" }
    )
    expect(code).toBe(0)
    expect(output).toBe(
      "wrote kirana-report.md: describe what happened and add a reproduction at the top, read the rest, then paste it into an issue\n"
    )
    const text = readFileSync(path.join(root, "kirana-report.md"), "utf8")
    expect(text).toMatch(/^# Kirana bug report\n\n## What happened\n/)
    expect(text).toContain(
      "| Packages | @kirana-style/compiler@0.1.0, @kirana-style/core@0.1.0 |"
    )
    expect(text).toContain("- ✓ **engine** native (")
    expect(text).toContain(
      "| KRN1201 | unknown-property | error | 1 | `src/box.tsx:4:3` |"
    )
    expect(text).toMatch(/1 module\(s\), 1 site\(s\), \d+ atom\(s\)/)
    expect(text).toContain("```console\nminHeight at <project>/src/box.tsx:3")
    expect(text).toContain("firstThatWorks(100dvh, 100vh)")
    expect(text).toContain('"root": "<project>"')
    // Nothing of the machine, and no source text.
    expect(text).not.toContain(root)
    expect(text).not.toContain('colour: "red"')
  })

  it("prints JSON, writes where it is told, and says when the engine is missing", async () => {
    const root = setUp()
    let output = ""
    const write = (text: string) => void (output += text)
    expect(await runReport(["--report", "--json"], root, write, load)).toBe(0)
    const report = JSON.parse(output) as Report
    expect(report.engine).toMatchObject({ engine: expect.any(String) })
    expect(report.trace).toBeUndefined()
    expect(JSON.stringify(report)).not.toContain(root)

    output = ""
    expect(await runReport(["--report", "bug.md"], root, write, load)).toBe(0)
    expect(output).toMatch(/^wrote bug\.md: /)
    expect(readFileSync(path.join(root, "bug.md"), "utf8")).toContain(
      "## Diagnostics"
    )
    const outside = path.join(project({}), "report.md")
    output = ""
    expect(await runReport(["--report", outside], root, write, load)).toBe(0)
    expect(output).toMatch(
      new RegExp(`^wrote ${outside.replace(/[.\\/]/g, "\\$&")}: `)
    )

    const bare = project({ "package.json": "{}" })
    const failing = () => {
      throw new Error("no engine for this machine")
    }
    output = ""
    expect(await runReport(["--report"], bare, write, failing)).toBe(1)
    const text = readFileSync(path.join(bare, "kirana-report.md"), "utf8")
    expect(text).toContain(
      "| Engine | not loaded: no engine for this machine |"
    )
    expect(text).toContain("| Packages | none |")
    expect(text).not.toContain("## Diagnostics")
    expect(
      await runReport(["--report", "--trace", "a.tsx:1"], bare, write, load)
    ).toBe(2)
    expect(output).toContain("--trace takes <file>:<line> <property>\n")
  })

  it("redacts the project, the home directory, the user and secrets", () => {
    const machine = { home: "/home/someone", user: "someone" }
    expect(
      redact(
        {
          root: "/work/app",
          files: ["/work/app/src/a.tsx", "/home/someone/lib.ts"],
          note: "someone ran it; someone-else and trace did not",
          apiKey: "x",
          count: 3,
        },
        "/work/app",
        machine
      )
    ).toEqual({
      root: "<project>",
      files: ["<project>/src/a.tsx", "~/lib.ts"],
      note: "<user> ran it; someone-else and trace did not",
      apiKey: "<redacted>",
      count: 3,
    })
    expect(redact("/home/x", "/work", { home: "", user: "" })).toBe("/home/x")
  })

  it("lists a package that is listed but not installed, and no diagnostics as none", async () => {
    const root = project({
      "package.json": JSON.stringify({
        name: "app",
        dependencies: { "@kirana-style/core": "0" },
      }),
      "src/a.ts": "export const a = 1\n",
    })
    const report = await collect(root, undefined, load)
    const text = markdown(report)
    expect(text).toContain("| Packages | @kirana-style/core@not installed |")
    expect(text).toContain("## Diagnostics\n\nNone.\n")
  })

  it("is what `kirana doctor --report` runs", async () => {
    const root = setUp()
    let output = ""
    expect(
      await main(
        ["doctor", "--report", "--json"],
        root,
        (text) => (output += text),
        native
      )
    ).toBe(0)
    expect(JSON.parse(output)).toHaveProperty("engine.engine")
  })
})
