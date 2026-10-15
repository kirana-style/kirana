/**
 * The compiler session the rules read (KRN-DX-009): one Driver per project root, the project
 * compiled once per lint run, and each linted file transformed once however many rules ask.
 * Rules never re-implement what the compiler knows; they look its answers up here.
 */
import { existsSync } from "node:fs"
import path from "node:path"

import { Driver, utf16Offset } from "@kirana-style/compiler"
import type { Diagnostic, Site } from "@kirana-style/compiler"

import type { Context } from "./types.ts"

const CONFIGS = [
  "kirana.config.ts",
  "kirana.config.mts",
  "kirana.config.js",
  "kirana.config.mjs",
  "kirana.config.json",
]

/** The directory of the nearest `kirana.config.*` above `file`, else `fallback`. */
export function rootOf(file: string, fallback: string): string {
  let directory = path.dirname(file)
  while (!CONFIGS.some((name) => existsSync(path.join(directory, name)))) {
    const parent = path.dirname(directory)
    if (parent === directory) return fallback
    directory = parent
  }
  return directory
}

const drivers = new Map<string, Driver>()

/** The session for a root, opened and compiled once (`kirana-style check` over the root). */
export function driverFor(root: string): Driver {
  let driver = drivers.get(root)
  if (!driver) {
    driver = Driver.createSync({ root })
    driver.check(["."])
    drivers.set(root, driver)
  }
  return driver
}

/** What the compiler says about one file. */
export type Inspection = {
  driver: Driver
  file: string
  text: string
  /** The file's own diagnostics and the project-wide ones that name it. */
  diagnostics: Diagnostic[]
  /** Style sites in the file, spans as JavaScript string indices. */
  sites: Site[]
  /** A UTF-8 byte offset (the engine's) as a string index. */
  index: (byte: number) => number
}

const inspections = new Map<string, Inspection>()

/**
 * The compiler's view of the file being linted. `settings.kirana.root` (relative to the working
 * directory) names the project root; otherwise it is the nearest `kirana.config.*`, else the
 * working directory.
 */
export function inspect(context: Context): Inspection {
  const file = context.filename
  const text = context.sourceCode.text
  const cached = inspections.get(file)
  if (cached?.text === text) return cached
  const configured = (context.settings.kirana as { root?: string } | undefined)
    ?.root
  const root = configured
    ? path.resolve(context.cwd, configured)
    : rootOf(file, context.cwd)
  const driver = driverFor(root)
  const result = driver.transform(file, text)
  const relative = path.relative(driver.root, file).split(path.sep).join("/")
  // ASCII text has the same byte and string offsets.
  const ascii = Buffer.byteLength(text) === text.length
  const index = ascii
    ? (byte: number) => byte
    : (byte: number) => utf16Offset(text, byte)
  const inspection: Inspection = {
    driver,
    file,
    text,
    diagnostics: [
      ...result.diagnostics,
      ...driver
        .diagnostics()
        .filter((diagnostic) => diagnostic.file === relative),
    ],
    sites: driver.sites(file).map((site) => ({
      ...site,
      span: { start: index(site.span.start), end: index(site.span.end) },
    })),
    index,
  }
  inspections.set(file, inspection)
  return inspection
}

/** Forgets every session (tests, and editors that lint after the configuration changed). */
export function reset(): void {
  drivers.clear()
  inspections.clear()
}
