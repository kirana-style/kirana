import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"

import transformer, { createTransformer } from "../src/index.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project next to the tests, with two stand-in transformers installed. */
function project(): string {
  const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  created.push(root)
  writeFileSync(path.join(root, "package.json"), '{"name":"app"}')
  // A stand-in for babel-jest: CommonJS with `createTransformer`, marking what it was given.
  const stub = path.join(root, "node_modules/stub-transformer")
  mkdirSync(stub, { recursive: true })
  writeFileSync(
    path.join(stub, "index.cjs"),
    "exports.createTransformer = (config) => ({ process: (source) => ({ code: `/* next ${JSON.stringify(config)} */\\n${source}` }) })\n"
  )
  writeFileSync(
    path.join(stub, "package.json"),
    '{"name":"stub-transformer","main":"index.cjs"}'
  )
  // A transformer that is a plain object, exported as an ES module's default.
  const plain = path.join(root, "node_modules/plain-transformer")
  mkdirSync(plain, { recursive: true })
  writeFileSync(
    path.join(plain, "index.cjs"),
    'module.exports = { default: { process: (source) => "plain:" + source } }\n'
  )
  writeFileSync(
    path.join(plain, "package.json"),
    '{"name":"plain-transformer","main":"index.cjs"}'
  )
  return root
}

describe("KRN-INT-003 Jest", () => {
  it("compiles styles, then hands the module to the next transformer", () => {
    const root = project()
    const jest = createTransformer({
      root,
      transformer: "stub-transformer",
      transformerConfig: { presets: ["x"] },
    })
    expect(jest.canInstrument).toBe(false)
    const file = path.join(root, "src/a.tsx")
    const out = jest.process(
      'import { css } from "@kirana-style/core"\nexport const A = () => <p sx={css({ display: "grid" })} />\n',
      file,
      {}
    ) as { code: string }
    expect(out.code).toContain('/* next {"presets":["x"]} */')
    expect(out.code).toContain('className="k5O_')
    // Modules without styles pass straight through; the Driver and the next transformer are reused.
    const plain = jest.process(
      "export const x = 1\n",
      path.join(root, "src/b.ts"),
      {}
    ) as {
      code: string
    }
    expect(plain.code).toContain("export const x = 1")
    const comment = "// @kirana-style/ in a comment\nexport const y = 2\n"
    expect(
      (
        jest.process(comment, path.join(root, "src/c.ts"), {}) as {
          code: string
        }
      ).code
    ).toContain(comment)
  })

  it("warns, throws on errors, and accepts a transformer that is a plain object", () => {
    const root = project()
    const jest = transformer.createTransformer({
      root,
      transformer: "plain-transformer",
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const tied =
      'import { css } from "@kirana-style/core"\nexport const a = css({ color: { "[data-a]": "red", "[data-b]": "blue" } })\n'
    expect(jest.process(tied, path.join(root, "a.ts"), {})).toMatch(/^plain:/)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ambiguous-precedence")
    )
    // An info (a value bridged at runtime) is not a warning: nothing is printed.
    warn.mockClear()
    jest.process(
      'import { css } from "@kirana-style/core"\nexport const w = (value) => css({ width: value })\n',
      path.join(root, "w.js"),
      {}
    )
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    expect(() =>
      jest.process(
        'import { css } from "@kirana-style/core"\nexport const b = css({ colour: "red" })\n',
        path.join(root, "b.ts"),
        {}
      )
    ).toThrow("unknown-property")
  })

  it("defaults to the working directory and babel-jest", () => {
    const jest = createTransformer()
    expect(() => jest.process("export const x = 1\n", "/a.ts", {})).toThrow(
      "babel-jest"
    )
  })
})
