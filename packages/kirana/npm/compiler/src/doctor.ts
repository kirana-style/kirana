/**
 * `kirana-style doctor [--json]` (KRN-DX-008): what a project's Kirana setup is, and what is missing. It
 * reports the engine in use, the installed `@kirana-style/*` packages, the configuration, the detected
 * framework, bundler and package manager, whether the adapter, stylesheet and `sx` types are wired
 * (by running `kirana-style init`'s plan without writing), and the cache: there is none (D-049). It exits
 * with 1 when something fails. `--report` writes a bug report instead (`report.ts`).
 */
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { jsxDetection } from "./config.ts"
import { Driver } from "./driver.ts"
import { KIRANA_LIBRARIES } from "./host.ts"
import type { NativeBinding } from "./native.ts"
import { engineOf, loadNative } from "./native.ts"
import { packageManagerOf, readPackage, runCommand } from "./detect.ts"
import { describe, plan } from "./init.ts"

/** The libraries the configuration lists: Kirana's own are compiled without being named. */
const configuredLibraries = (driver: Driver) =>
  driver.libraries.filter((name) => !KIRANA_LIBRARIES.includes(name))

export type Check = {
  name: string
  status: "ok" | "warn" | "fail"
  detail: string
}

/**
 * The version of every Kirana package the project lists (`kirana-style` and `@kirana-style/*`), as
 * installed; `undefined` if not.
 */
export function installedVersions(
  root: string
): Record<string, string | undefined> {
  const pkg = readPackage(root)
  const require = createRequire(path.join(root, "package.json"))
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter(
      (name) => name === "kirana-style" || name.startsWith("@kirana-style/")
    )
    .sort()
  return Object.fromEntries(
    names.map((name) => {
      try {
        const file = require.resolve(`${name}/package.json`)
        return [name, (require(file) as { version: string }).version]
      } catch {
        // A package whose `exports` hides its package.json cannot be resolved by that path.
        return [name, nodeModulesVersion(root, name)]
      }
    })
  )
}

/** An installed package's version, from the nearest `node_modules` that has it. */
function nodeModulesVersion(root: string, name: string): string | undefined {
  for (let directory = root; ; directory = path.dirname(directory)) {
    const file = path.join(directory, "node_modules", name, "package.json")
    if (existsSync(file))
      return (JSON.parse(readFileSync(file, "utf8")) as { version: string })
        .version
    if (path.dirname(directory) === directory) return undefined
  }
}

/**
 * Why `sx` compiles to `className` in a Solid project: no `jsx` in the configuration, and no Solid
 * `jsxImportSource` in the tsconfig files `jsx` detection read, which it names.
 */
function reactOnSolid(root: string, configRoot: string): string {
  const { files } = jsxDetection(configRoot)
  const read = files.length
    ? `read ${files.map((file) => path.relative(root, file)).join(", ")}`
    : "no tsconfig.json"
  return `sx compiles to React's className, which Solid does not read: set jsx: "solid", or Solid's jsxImportSource in tsconfig.json (${read})`
}

/** Every check, in the order they are printed. */
export async function diagnose(
  root: string,
  load: () => NativeBinding = loadNative
): Promise<Check[]> {
  const checks: Check[] = []
  let native: NativeBinding | undefined
  try {
    native = load()
    const engine = engineOf(native)
    checks.push({
      name: "engine",
      status: "ok",
      detail:
        engine === "wasi"
          ? "WebAssembly (WASI): no native build loaded for this machine"
          : `native (${process.platform}-${process.arch})`,
    })
  } catch (error) {
    checks.push({
      name: "engine",
      status: "fail",
      detail: (error as Error).message,
    })
  }

  const versions = installedVersions(root)
  const listed = Object.entries(versions)
  const missing = listed
    .filter(([, version]) => version === undefined)
    .map(([name]) => name)
  const distinct = new Set(listed.map(([, version]) => version).filter(Boolean))
  checks.push(
    listed.length === 0
      ? {
          name: "packages",
          status: "fail",
          detail: "no Kirana package in package.json",
        }
      : missing.length
        ? {
            name: "packages",
            status: "fail",
            detail: `listed but not installed: ${missing.join(", ")}`,
          }
        : {
            name: "packages",
            status: distinct.size > 1 ? "warn" : "ok",
            detail:
              listed.map(([name, version]) => `${name}@${version}`).join(", ") +
              (distinct.size > 1
                ? " — versions differ; install one release of every package"
                : ""),
          }
  )

  const setup = plan(root)
  if (native) {
    try {
      const driver = await Driver.create({ root, native })
      const detail = driver.configFile
        ? `${path.relative(root, driver.configFile)}, prefix "${driver.prefix}"${configuredLibraries(driver).length ? `, libraries ${configuredLibraries(driver).join(", ")}` : ""}`
        : "no kirana.config: every key at its default"
      // Solid's JSX has no `className`: `sx` compiled as React's leaves every element without its
      // classes, and the build says nothing (KF-132).
      const react =
        setup.project.framework === "solid" &&
        driver.classAttribute === "className"
      checks.push({
        name: "config",
        status: react ? "warn" : "ok",
        detail: react
          ? `${detail}; ${reactOnSolid(root, driver.root)}`
          : detail,
      })
    } catch (error) {
      checks.push({
        name: "config",
        status: "fail",
        detail: (error as Error).message,
      })
    }
  }

  checks.push({
    name: "project",
    status: "ok",
    detail: describe(setup.project),
  })
  for (const step of setup.steps) {
    if (step.name === "config") continue
    checks.push({
      name: step.name,
      status:
        step.status === "done" ? "ok" : step.name === "types" ? "warn" : "fail",
      detail:
        step.status === "done"
          ? step.detail
          : step.status === "change"
            ? `not set up: kirana-style init would ${step.detail}`
            : `not set up: ${step.detail}`,
    })
  }
  const absent = [...setup.dependencies, ...setup.development]
  if (absent.length)
    checks.push({
      name: "dependencies",
      status: "fail",
      detail: `not in package.json: ${absent.join(", ")}`,
    })
  checks.push({
    name: "cache",
    status: "ok",
    detail: "none on disk: every build compiles from source (D-049)",
  })
  return checks
}

/** `kirana-style doctor [--json]`. */
export async function runDoctor(
  argv: readonly string[],
  root: string,
  write: (text: string) => void,
  load?: () => NativeBinding
): Promise<number> {
  const checks = await diagnose(root, load)
  if (argv.includes("--json")) {
    write(`${JSON.stringify(checks, null, 2)}\n`)
  } else {
    const marks = { ok: "✓", warn: "!", fail: "✗" }
    for (const check of checks)
      write(`${marks[check.status]} ${check.name.padEnd(12)} ${check.detail}\n`)
    const failed = checks.filter((check) => check.status === "fail").length
    const init = runCommand(
      packageManagerOf(root, readPackage(root)),
      "kirana-style init"
    )
    write(
      failed
        ? `\n${failed} problem(s). ${init} sets up what it can.\n`
        : "\nAll good.\n"
    )
  }
  return checks.some((check) => check.status === "fail") ? 1 : 0
}
