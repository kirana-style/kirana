/**
 * The GritQL rules against Biome itself, and against their ESLint originals: one fixture goes through
 * both, and the reports (line, column, message) must match. The Biome version is pinned, because
 * Biome's GritQL grammar can change between releases.
 */
import { spawnSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"

import eslint from "@kirana-style/eslint-plugin"
import { Linter } from "eslint"
import { afterAll, describe, expect, it } from "vite-plus/test"

const require = createRequire(import.meta.url)
const biome = path.join(
  path.dirname(require.resolve("@biomejs/biome/package.json")),
  "bin/biome"
)
const plugin = path.join(import.meta.dirname, "..")
const fixture = path.join(import.meta.dirname, "fixtures/case.tsx")
const rules = readdirSync(path.join(plugin, "rules")).map((file) =>
  file.replace(/\.grit$/, "")
)

type Report = { line: number; column: number; message: string }

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project with the fixture, this package installed, and `biome.json`. */
function project(config: object): string {
  const root = mkdtempSync(path.join(tmpdir(), "kirana-biome-"))
  created.push(root)
  mkdirSync(path.join(root, "node_modules/@kirana-style"), { recursive: true })
  symlinkSync(
    plugin,
    path.join(root, "node_modules/@kirana-style/biome-plugin")
  )
  cpSync(fixture, path.join(root, "case.tsx"))
  writeFileSync(path.join(root, "biome.json"), JSON.stringify(config))
  return root
}

/** Biome's reports for the fixture, by rule. */
function lint(root: string): Map<string, Report[]> {
  const result = spawnSync(
    biome,
    ["lint", "--reporter=json", "--max-diagnostics=none", "case.tsx"],
    { cwd: root, encoding: "utf8" }
  )
  const { diagnostics } = JSON.parse(result.stdout) as {
    diagnostics: {
      category: string
      message: string
      location: { start: { line: number; column: number } }
    }[]
  }
  const reports = new Map<string, Report[]>()
  for (const diagnostic of diagnostics) {
    expect(diagnostic.category).toBe("plugin")
    const [, rule, message] = /^kirana\/([\w-]+): (.*)$/s.exec(
      diagnostic.message
    )!
    const list = reports.get(rule!) ?? []
    list.push({ ...diagnostic.location.start, message: message! })
    reports.set(rule!, list)
  }
  return reports
}

const only = { linter: { rules: { recommended: false } } }

describe("@kirana-style/biome-plugin", () => {
  it("reports what the ESLint rules report, rule for rule", () => {
    const reports = lint(
      project({
        extends: ["./node_modules/@kirana-style/biome-plugin/strict.json"],
        ...only,
      })
    )
    const linter = new Linter({ configType: "flat" })
    for (const rule of rules) {
      const messages = linter.verify(
        readFileSync(fixture, "utf8"),
        {
          files: ["**/*.tsx"],
          languageOptions: {
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          plugins: { kirana: eslint },
          rules: { [`kirana/${rule}`]: "error" },
        } as never,
        "case.tsx"
      )
      const expected = messages.map(({ line, column, message }) => ({
        line,
        column,
        message,
      }))
      expect(expected.length, rule).toBeGreaterThan(0)
      expect(reports.get(rule), rule).toEqual(expected)
    }
    expect([...reports.keys()].sort()).toEqual([...rules].sort())
  })

  it("ships presets that name every rule and resolve where they are installed", () => {
    const strict = JSON.parse(
      readFileSync(path.join(plugin, "strict.json"), "utf8")
    ) as { plugins: string[] }
    expect(
      strict.plugins.map((file) => path.basename(file, ".grit")).sort()
    ).toEqual([...rules].sort())
    const reports = lint(
      project({ extends: ["@kirana-style/biome-plugin/recommended"], ...only })
    )
    expect([...reports.keys()].sort()).toEqual([
      "no-conflicting-props",
      "no-dark-variant",
      "sx-last",
    ])
  })
})
