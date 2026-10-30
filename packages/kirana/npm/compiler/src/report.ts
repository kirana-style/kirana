/**
 * `kirana-style doctor --report [file] [--trace <file>:<line> <property>] [--json]` (KRN-DX-008): a
 * bug report to paste into an issue, with what CONTRIBUTING asks for plus the doctor's checks, the
 * stylesheet's size and the resolved configuration. Nothing in it identifies the machine or its owner
 * (D-077): the root, home directory and user name are replaced, values under secret-named keys are
 * masked, and no environment variable or source text is read into it.
 */
import { writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { resolveConfig } from "./config.ts"
import type { Check } from "./doctor.ts"
import { diagnose, installedVersions } from "./doctor.ts"
import type { NativeBinding } from "./native.ts"
import { loadNative } from "./native.ts"

/** What the engine reports about a compile of the project (`kirana-style report`). */
export type EngineReport = {
  engine: string
  work: { seen: number; prefiltered: number; parsed: number; resolved: number }
  stylesheet: { modules: number; sites: number; atoms: number; bytes: number }
  diagnostics: {
    code: string
    name: string
    severity: string
    count: number
    first: string
  }[]
}

export type Report = {
  environment: { os: string; node: string }
  packages: Record<string, string | undefined>
  checks: Check[]
  engine: EngineReport | { error: string }
  config: unknown
  trace?: string
}

/** Where the report came from: the machine's identity, for redaction. */
export type Machine = { home: string; user: string }

const SECRET = /secret|password|passwd|credential|api[-_]?key|auth/i

/** Replaces the project root, the home directory and the user name in every string of `value`. */
export function redact(
  value: unknown,
  root: string,
  machine: Machine
): unknown {
  if (typeof value === "string") {
    let text = value.split(root).join("<project>")
    if (machine.home) text = text.split(machine.home).join("~")
    if (machine.user)
      text = text.replace(
        new RegExp(`(?<![\\w-])${escape(machine.user)}(?![\\w-])`, "g"),
        "<user>"
      )
    return text
  }
  if (Array.isArray(value))
    return value.map((item) => redact(item, root, machine))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SECRET.test(key) ? "<redacted>" : redact(inner, root, machine),
      ])
    )
  return value
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** The report's data, redacted. */
export async function collect(
  root: string,
  trace: readonly string[] | undefined,
  load: () => NativeBinding = loadNative,
  machine: Machine = { home: os.homedir(), user: os.userInfo().username }
): Promise<Report> {
  const checks = await diagnose(root, load)
  let engine: Report["engine"]
  let config: unknown = {}
  let traced: string | undefined
  try {
    const native = load()
    const { json } = await resolveConfig(root)
    config = JSON.parse(json)
    const run = (...args: string[]) =>
      native.runCli(["kirana-style", "--config-json", json, ...args])
    engine = JSON.parse(run("report")[1]) as EngineReport
    if (trace) {
      // The location is relative to the project, wherever the command runs from.
      const [location, property] = trace as [string, string]
      traced = run("trace", path.resolve(root, location), property)[1].trimEnd()
    }
  } catch (error) {
    engine = { error: (error as Error).message }
  }
  const report: Report = {
    environment: {
      os: `${process.platform} ${os.release()} ${process.arch}`,
      node: process.version,
    },
    packages: installedVersions(root),
    checks,
    engine,
    config,
    ...(traced === undefined ? {} : { trace: traced }),
  }
  return redact(report, root, machine) as Report
}

const marks = { ok: "✓", warn: "!", fail: "✗" }

/** The report as an issue body: what the reporter writes first, then what was collected. */
export function markdown(report: Report): string {
  const lines = [
    "# Kirana bug report",
    "",
    "## What happened",
    "",
    "<!-- What you ran, the style you expected and the one you got. -->",
    "",
    "## Smallest reproduction",
    "",
    "<!-- The smallest source that shows it: a file, a repository or a playground link. -->",
    "",
    "## Environment",
    "",
    "| | |",
    "| --- | --- |",
    `| Engine | ${"error" in report.engine ? `not loaded: ${report.engine.error}` : report.engine.engine} |`,
    `| Node.js | ${report.environment.node} |`,
    `| OS | ${report.environment.os} |`,
    `| Project | ${report.checks.find((check) => check.name === "project")!.detail} |`,
    `| Packages | ${
      Object.entries(report.packages)
        .map(([name, version]) => `${name}@${version ?? "not installed"}`)
        .join(", ") || "none"
    } |`,
    "",
    "## Doctor",
    "",
    ...report.checks.map(
      (check) => `- ${marks[check.status]} **${check.name}** ${check.detail}`
    ),
    "",
  ]
  if (!("error" in report.engine)) {
    const { work, stylesheet, diagnostics } = report.engine
    lines.push("## Diagnostics", "")
    if (diagnostics.length) {
      lines.push(
        "| Code | Name | Severity | Count | First |",
        "| --- | --- | --- | --- | --- |",
        ...diagnostics.map(
          (diagnostic) =>
            `| ${diagnostic.code} | ${diagnostic.name} | ${diagnostic.severity} | ${diagnostic.count} | \`${diagnostic.first}\` |`
        )
      )
    } else lines.push("None.")
    lines.push(
      "",
      "## Stylesheet",
      "",
      `${stylesheet.modules} module(s), ${stylesheet.sites} site(s), ${stylesheet.atoms} atom(s), ${stylesheet.bytes} bytes minified. ` +
        `${work.seen} module(s) seen, ${work.prefiltered} rejected by the prefilter, ${work.parsed} parsed, ${work.resolved} parsed for imports.`,
      ""
    )
  }
  if (report.trace !== undefined)
    lines.push("## Trace", "", "```console", report.trace, "```", "")
  lines.push(
    "## Configuration",
    "",
    "```json",
    JSON.stringify(report.config, null, 2),
    "```",
    ""
  )
  return lines.join("\n")
}

/**
 * `kirana-style doctor --report`: writes the Markdown report (`kirana-report.md` unless a file follows
 * the flag) or, with `--json`, prints the data. Exits as `kirana-style doctor` does.
 */
export async function runReport(
  argv: readonly string[],
  root: string,
  write: (text: string) => void,
  load?: () => NativeBinding,
  machine?: Machine
): Promise<number> {
  const at = argv.indexOf("--trace")
  const trace = at === -1 ? undefined : argv.slice(at + 1, at + 3)
  if (trace && trace.length < 2) {
    write("--trace takes <file>:<line> <property>\n")
    return 2
  }
  const report = await collect(root, trace, load, machine)
  const code = report.checks.some((check) => check.status === "fail") ? 1 : 0
  if (argv.includes("--json")) {
    write(`${JSON.stringify(report, null, 2)}\n`)
    return code
  }
  const next = argv[argv.indexOf("--report") + 1]
  const file = path.resolve(
    root,
    next && !next.startsWith("--") ? next : "kirana-report.md"
  )
  writeFileSync(file, markdown(report))
  // Inside the project, the path relative to it; elsewhere, the whole path.
  const shown = path.relative(root, file)
  write(
    `wrote ${shown.startsWith("..") ? file : shown}: describe what happened and add a reproduction at the top, read the rest, then paste it into an issue\n`
  )
  return code
}
