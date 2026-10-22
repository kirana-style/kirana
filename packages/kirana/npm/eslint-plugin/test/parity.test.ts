/**
 * M3's exit criterion: lint results identical under Oxlint and ESLint (doc 18). The same fixtures
 * go through both — Oxlint loading the plugin through `jsPlugins`, ESLint through flat config — and
 * the reports (rule, line, column, message) and the autofixed text must match.
 */
import { spawnSync } from "node:child_process"
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { createRequire } from "node:module"
import path from "node:path"

import { Linter } from "eslint"
import { describe, expect, it } from "vite-plus/test"

import plugin from "../src/index.ts"

const require = createRequire(import.meta.url)
const oxlint = path.join(
  path.dirname(require.resolve("oxlint/package.json")),
  "bin/oxlint"
)
const fixtures = path.join(import.meta.dirname, "fixtures/parity")
// The strict rules, and the two a project turns on itself, one of them with its options.
const rules: Record<string, unknown> = {
  ...plugin.configs.strict.rules,
  "kirana/restricted-properties": [
    "error",
    {
      float: { reason: "Use flex or grid." },
      display: { values: ["flex", "grid"] },
    },
  ],
  "kirana/use-logical-properties": "warn",
}

type Report = { rule: string; line: number; column: number; message: string }

/** Oxlint's configuration for the strict rules, in a directory of its own. */
function oxlintConfig(): string {
  const file = path.join(
    mkdtempSync(path.join(tmpdir(), "kirana-oxlint-")),
    ".oxlintrc.json"
  )
  writeFileSync(
    file,
    JSON.stringify({
      plugins: [],
      categories: { correctness: "off" },
      jsPlugins: [
        {
          name: "kirana",
          specifier: path.join(import.meta.dirname, "../src/index.ts"),
        },
      ],
      rules,
    })
  )
  return file
}

function viaOxlint(directory: string): Report[] {
  // Oxlint exits 1 when it reports errors; the report is what is compared.
  const output = spawnSync(
    oxlint,
    ["-c", oxlintConfig(), "--format", "json", directory],
    { encoding: "utf8" }
  ).stdout
  const { diagnostics } = JSON.parse(output) as {
    diagnostics: Array<{
      code: string
      message: string
      filename: string
      labels: Array<{ span: { line: number; column: number } }>
    }>
  }
  return diagnostics.map((diagnostic) => ({
    rule: `${path.basename(diagnostic.filename)}:${diagnostic.code.replace(/^kirana\((.*)\)$/, "kirana/$1")}`,
    line: diagnostic.labels[0]!.span.line,
    column: diagnostic.labels[0]!.span.column,
    message: diagnostic.message,
  }))
}

const eslintConfig = [
  {
    files: ["**/*.jsx"],
    plugins: plugin.configs.strict.plugins,
    rules,
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
]

function viaEslint(directory: string): Report[] {
  const linter = new Linter({ configType: "flat" })
  return readdirSync(directory)
    .filter((name) => name.endsWith(".jsx"))
    .flatMap((name) =>
      linter
        .verify(
          readFileSync(path.join(directory, name), "utf8"),
          eslintConfig as never,
          path.join(directory, name)
        )
        .map((message) => ({
          rule: `${name}:${message.ruleId}`,
          line: message.line,
          column: message.column,
          message: message.message,
        }))
    )
}

const sorted = (reports: Report[]) =>
  [...reports].sort((a, b) =>
    `${a.rule}${a.line}:${a.column}`.localeCompare(
      `${b.rule}${b.line}:${b.column}`
    )
  )

describe("Oxlint and ESLint", () => {
  it("report the same problems at the same places", () => {
    const eslint = sorted(viaEslint(fixtures))
    // Every rule here has something to report in the fixtures, so every rule is compared.
    expect(new Set(eslint.map((report) => report.rule.split(":")[1]))).toEqual(
      new Set(Object.keys(rules))
    )
    expect(sorted(viaOxlint(fixtures))).toEqual(eslint)
  })

  it("fix to the same text", () => {
    const copy = mkdtempSync(
      path.join(import.meta.dirname, "fixtures/.parity-fix-")
    )
    try {
      cpSync(fixtures, copy, { recursive: true })
      spawnSync(oxlint, ["-c", oxlintConfig(), "--fix", copy], {
        encoding: "utf8",
      })
      const linter = new Linter({ configType: "flat" })
      for (const name of readdirSync(fixtures).filter((entry) =>
        entry.endsWith(".jsx")
      )) {
        const source = readFileSync(path.join(fixtures, name), "utf8")
        const fixed = linter.verifyAndFix(
          source,
          eslintConfig as never,
          path.join(copy, name)
        ).output
        expect(readFileSync(path.join(copy, name), "utf8"), name).toBe(fixed)
      }
    } finally {
      rmSync(copy, { recursive: true, force: true })
    }
  })
})
