import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

import type { Diagnostic } from "../src/index.ts"
import {
  KIRANA_LIBRARIES,
  PLACEHOLDER,
  compiledLibraries,
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
    // A plugin's generated module, though its id ends in `.js` (@vitejs/plugin-rsc's CSS module).
    expect(
      shouldCompile("virtual:vite-rsc/css?type=rsc&lang.js", '"@kirana-style/"')
    ).toBe(false)
    expect(shouldCompile("\0plugin:helper.js", "<a sx={x} />")).toBe(false)
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

  it("compiles Kirana's own style packages from node_modules without listing them", () => {
    const libraries = compiledLibraries([
      "acme-ui",
      "@kirana-style/preset-scales",
    ])
    expect(libraries).toEqual(["@kirana-style/preset-scales", "acme-ui"])
    const preset =
      "/app/node_modules/@kirana-style/preset-scales/src/compose.ts"
    expect(compilesModule(preset, compiledLibraries([]))).toBe(true)
    expect(compilesModule(preset, [])).toBe(false)
    // The runtime itself is what compiled calls are written against, never compiled.
    expect(
      compilesModule(
        "/app/node_modules/@kirana-style/core/src/index.ts",
        compiledLibraries([])
      )
    ).toBe(false)
  })

  it("lists every Kirana package that declares tokens or styles", () => {
    // A package whose own modules call these at the top level ships them uncompiled; an
    // application must compile it, or the first call throws in the browser.
    const packages = path.resolve(import.meta.dirname, "../..")
    const declaring =
      /^(?:export )?(?:const|let) \w+ = (?:defineTokens|css|keyframes|recipe|defineTheme)\(/m
    const found = readdirSync(packages)
      // The runtime is what compiled calls are written against; the compiler only quotes these
      // calls, in the sample file `init` writes.
      .filter((name) => name !== "core" && name !== "compiler")
      .filter((name) => {
        const sources = path.join(packages, name, "src")
        let files: string[]
        try {
          files = readdirSync(sources, { recursive: true }) as string[]
        } catch {
          return false
        }
        return files.some(
          (file) =>
            /\.[cm]?tsx?$/.test(file) &&
            declaring.test(readFileSync(path.join(sources, file), "utf8"))
        )
      })
      .map(
        (name) =>
          (
            JSON.parse(
              readFileSync(path.join(packages, name, "package.json"), "utf8")
            ) as { name: string }
          ).name
      )
    expect([...found].sort()).toEqual([...KIRANA_LIBRARIES].sort())
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
