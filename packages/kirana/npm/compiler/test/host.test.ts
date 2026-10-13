import { describe, expect, it } from "vitest"

import type { Diagnostic } from "../src/index.ts"
import {
  PLACEHOLDER,
  createReporter,
  digestOf,
  fillStylesheet,
  shouldCompile,
  compilesModule,
} from "../src/host.ts"

const diagnostic = (severity: Diagnostic["severity"]): Diagnostic => ({
  code: "KRN0000",
  name: severity,
  severity,
  file: "a.tsx",
  span: { start: 0, end: 0 },
  message: severity,
  help: [],
})

describe("host helpers", () => {
  it("selects modules for hosts without filters", () => {
    expect(
      shouldCompile("/a/b.tsx", 'import { css } from "@kirana-style/core"')
    ).toBe(true)
    expect(shouldCompile("/a/b.tsx?tsr-split=component", "<a sx={x} />")).toBe(
      true
    )
    expect(shouldCompile("/a/b.css", '"@kirana-style/"')).toBe(false)
    expect(shouldCompile("/a/b.ts?raw", '"@kirana-style/"')).toBe(false)
    expect(shouldCompile("C:\\a\\node_modules\\b.js", '"@kirana-style/"')).toBe(
      false
    )
    expect(shouldCompile("/a/b.ts", "export const x = 1")).toBe(false)
    // A listed library is compiled from node_modules, in npm's, pnpm's and Windows' layouts.
    const code = 'import { css } from "@kirana-style/core"'
    expect(
      shouldCompile("/app/node_modules/acme-ui/dist/a.js", code, ["acme-ui"])
    ).toBe(true)
    expect(
      compilesModule(
        "/app/node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui/a.js",
        ["@acme/ui"]
      )
    ).toBe(true)
    expect(
      compilesModule("C:\\app\\node_modules\\acme-ui\\a.js", ["acme-ui"])
    ).toBe(true)
    expect(compilesModule("/app/node_modules/acme-uix/a.js", ["acme-ui"])).toBe(
      false
    )
    expect(compilesModule("/app/src/a.ts", [])).toBe(true)
  })

  it("fills the placeholder, or says there is none", () => {
    expect(fillStylesheet(`a{}${PLACEHOLDER}`, ".x{}")).toBe("a{}.x{}")
    expect(fillStylesheet("a{}", ".x{}")).toBeUndefined()
    expect(digestOf("a")).not.toBe(digestOf("b"))
  })

  it("reports each module's warnings once per text, and errors every time", () => {
    const warnings: string[] = []
    const context = {
      warn: (message: string) => void warnings.push(message),
      error: (message: string): never => {
        throw new Error(message)
      },
    }
    const reporter = createReporter()
    const found = [diagnostic("warning"), diagnostic("info")]
    reporter.module(context, "a.tsx", "one", found)
    reporter.module(context, "a.tsx", "one", found)
    expect(warnings).toHaveLength(1)
    reporter.module(context, "a.tsx", "two", found)
    expect(warnings).toHaveLength(2)
    expect(() =>
      reporter.module(context, "a.tsx", "two", [diagnostic("error")])
    ).toThrow("error")

    const verbose = createReporter({ reportInfo: true })
    verbose.project(context, "/nowhere", found)
    verbose.project(context, "/nowhere", found)
    expect(warnings).toHaveLength(4)
  })
})
