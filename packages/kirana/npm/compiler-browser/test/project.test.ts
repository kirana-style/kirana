import * as fs from "node:fs"
import { mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vite-plus/test"

import { loadNative } from "@kirana-style/compiler"

import { openProject, positionOf } from "../src/project.ts"
import type { Engine } from "../src/project.ts"
import { runtime } from "../src/runtime.ts"

/**
 * The native engine on a directory, which is what the WebAssembly engine on its in-memory volume
 * is to a page: the same session, reading the files the project writes.
 */
const native = loadNative()
const engine: Engine = {
  Compiler: native.Compiler,
  LanguageServer: native.LanguageServer,
  __volume: fs,
}

/** A fresh root, POSIX and canonical so the engine's paths match the project's. */
function root(): string {
  return realpathSync(mkdtempSync(path.join(tmpdir(), "kirana-browser-")))
}

const TOKENS = `import { defineTokens } from "@kirana-style/core"
export const brand = defineTokens("brand", { accent: "light-dark(#00736a, #6fd6c8)" }, { variable: true })
`

const CARD = `import { css } from "@kirana-style/core"
import { brand } from "./tokens"
const card = css({ color: brand.accent, padding: { base: "1rem", ":hover": "2rem" } })
export function Card() {
  return <div sx={card}>Card</div>
}
`

describe("openProject", () => {
  it("compiles a module that reads tokens from another file", () => {
    const project = openProject(engine, {
      root: root(),
      files: { "src/tokens.ts": TOKENS, "src/Card.tsx": CARD },
    })
    expect(project.files()).toEqual(["src/tokens.ts", "src/Card.tsx"])
    const card = project.transform("src/Card.tsx")
    expect(card.diagnostics).toEqual([])
    expect(card.code).toContain('className="')
    expect(card.code).not.toContain("@kirana-style/core")
    expect(card.dependencies).toContain("src/tokens.ts")
    expect(card.cssChanged).toBe(true)
    const css = project.stylesheet()
    expect(css).toContain(":hover")
    expect(css).toContain("light-dark(#00736a, #6fd6c8)")
    expect(project.stylesheet(true).length).toBeLessThan(css.length)
    expect(project.diagnostics()).toEqual([])
  })

  it("gives the configuration to the engine as its JSON", () => {
    const at = root()
    const project = openProject(engine, {
      root: at,
      config: { names: { prefix: "p" }, layers: { before: ["reset"] } },
    })
    expect(JSON.parse(project.configJson)).toEqual({
      names: { prefix: "p" },
      layers: { before: ["reset"] },
      root: at,
    })
    project.write(
      "./a.tsx",
      `import { css } from "@kirana-style/core"\nexport const a = css({ display: "grid" })\n`
    )
    expect(project.transform("a.tsx").code).toMatch(/a = "p[\w-]+"/)
    expect(project.stylesheet()).toContain("@layer reset, kirana;")
  })

  it("opens with the defaults", () => {
    const project = openProject({
      ...engine,
      // The default root, `/app`, is not writable here: record what is written instead.
      __volume: {
        mkdirSync: () => undefined,
        writeFileSync: () => undefined,
        rmSync: () => undefined,
      },
    })
    expect(project.root).toBe("/app")
    expect(project.files()).toEqual([])
  })

  it("reports where a diagnostic is, in the file it names", () => {
    const project = openProject(engine, { root: root() })
    const source = `import { css } from "@kirana-style/core"\n// é\nexport const a = css({ padding: "red" })\n`
    project.write("a.tsx", source)
    const [diagnostic] = project.transform("a.tsx").diagnostics
    expect(diagnostic?.file).toBe("a.tsx")
    expect(diagnostic?.start?.line).toBe(3)
    expect(diagnostic?.end).toEqual(positionOf(source, diagnostic!.span.end))
  })

  it("keeps a diagnostic that names no file of the project as the engine wrote it", () => {
    const project = openProject(
      {
        ...engine,
        Compiler: class {
          transform = () => ({
            diagnostics: JSON.stringify([
              {
                code: "KRN0000",
                name: "elsewhere",
                severity: "warning",
                file: "",
                span: { start: 0, end: 0 },
                message: "m",
                help: [],
              },
            ]),
            cssChanged: false,
            dependencies: ["/elsewhere/x.ts"],
          })
          stylesheet = () => ""
          diagnostics = () => "[]"
          invalidate = () => []
          remove = () => true
        },
      },
      { root: root(), files: { "a.tsx": "" } }
    )
    const result = project.transform("a.tsx")
    expect(result.diagnostics[0]?.start).toBeUndefined()
    expect(result.dependencies).toEqual(["/elsewhere/x.ts"])
  })

  it("recompiles what read a file that changed, and forgets a removed one", () => {
    const project = openProject(engine, {
      root: root(),
      files: { "tokens.ts": TOKENS, "Card.tsx": CARD },
    })
    project.transform("Card.tsx")
    expect(
      project.write("tokens.ts", TOKENS.replace("#00736a", "#123456"))
    ).toContain("Card.tsx")
    project.transform("Card.tsx")
    expect(project.stylesheet()).toContain("#123456")
    project.remove("Card.tsx")
    expect(project.files()).toEqual(["tokens.ts"])
    expect(project.stylesheet()).not.toContain("#123456")
    expect(() => project.transform("Card.tsx")).toThrow(
      "Card.tsx is not a file of this project"
    )
  })
})

describe("the project's language server (KF-065)", () => {
  /** An inlay hint's label: its text, or its parts' text joined. */
  const label = (hint: { label: string | { value: string }[] }) =>
    typeof hint.label === "string"
      ? hint.label
      : hint.label.map((part) => part.value).join("")
  const whole = {
    start: { line: 0, character: 0 },
    end: { line: 99, character: 0 },
  }

  it("answers what an editor asks, on the files the project writes", () => {
    const project = openProject(engine, {
      root: root(),
      files: { "src/tokens.ts": TOKENS, "src/Card.tsx": CARD },
      language: { summaryLength: 0 },
    })
    const { language } = project
    const uri = language.uri("src/Card.tsx")
    expect(uri).toBe(`file://${project.root}/src/Card.tsx`)
    const hints = () =>
      (
        language.request("textDocument/inlayHint", {
          textDocument: { uri },
          range: whole,
        }) as { label: string | { value: string }[] }[]
      ).map(label)
    // The summary after `sx={card}`, as an editor draws it.
    expect(hints().join("\n")).toContain("hover:")
    const lenses = language.request("textDocument/codeLens", {
      textDocument: { uri },
    }) as { command: { title: string } }[]
    expect(lenses.map((lens) => lens.command.title).join("\n")).toContain(
      "css()"
    )
    // A file written now is the text the server reads.
    project.write("src/Card.tsx", CARD.replace('"2rem"', '"3rem"'))
    expect(hints().join("\n")).toContain("3rem")
    // A notification hands back what the server sends.
    const sent = language.notify("textDocument/didChange", {
      textDocument: { uri, version: 9 },
      contentChanges: [{ text: CARD }],
    })
    expect(sent[0]).toMatchObject({
      method: "textDocument/publishDiagnostics",
      params: { uri },
    })
    expect(() =>
      language.request("textDocument/semanticTokens/full", {})
    ).toThrow("unhandled request")
    // A removed file closes, and is gone; one never written was never open.
    project.remove("src/Card.tsx")
    project.remove("src/Never.tsx")
    expect(hints).toThrow("cannot read")
  })
})

describe("the binding's LanguageServer", () => {
  it("throws on an argument, a configuration or a message it cannot read", () => {
    // An argument that is not a string, then text that is not JSON or no configuration.
    expect(() => new native.LanguageServer(1 as never, "{}")).toThrow()
    expect(() => new native.LanguageServer("{}", 1 as never)).toThrow()
    expect(() => new native.LanguageServer("not json", "{}")).toThrow()
    expect(() => new native.LanguageServer("{}", "not json")).toThrow()
    const server = new native.LanguageServer(
      JSON.stringify({ root: root() }),
      "{}"
    )
    expect(() => server.request("textDocument/hover", "not json")).toThrow()
    expect(() => server.notify("textDocument/didOpen", "not json")).toThrow()
    expect(() => server.request(1 as never, "{}")).toThrow()
    expect(() => server.notify("textDocument/didOpen", 1 as never)).toThrow()
  })
})

describe("positionOf", () => {
  it("counts lines from 1 and columns in UTF-16 code units", () => {
    expect(positionOf("ab\nc😀d", 0)).toEqual({ line: 1, column: 1 })
    expect(positionOf("ab\nc😀d", 3)).toEqual({ line: 2, column: 1 })
    // `😀` is four bytes and two code units.
    expect(positionOf("ab\nc😀d", 8)).toEqual({ line: 2, column: 4 })
  })
})

describe("runtime", () => {
  it("is the core's", () => {
    expect(runtime("k", "className").cx("a", "b")).toBe("a b")
  })
})
