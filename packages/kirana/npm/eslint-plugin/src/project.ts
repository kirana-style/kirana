/**
 * The compiler session the rules read (KRN-DX-009): one Driver per project root, the project
 * compiled once per lint run, and each linted file transformed once however many rules ask.
 * Rules never re-implement what the compiler knows; they look its answers up here.
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import {
  Driver,
  frameworkOf,
  loadNative,
  utf16Offset,
} from "@kirana-style/compiler"
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
 * The module a file's linted text is compiled as. A Vue, Svelte or Astro component's linter hands
 * a rule one script block, which the build compiles as `Card.vue.setup.ts`: under that id the
 * compiler knows the template, not part of the module, reads the block's bindings (`const { sx } =
 * useSx()`, KF-026). Any other file is its own module.
 */
function moduleOf(file: string, text: string): string {
  if (!frameworkOf(file) || !existsSync(file)) return file
  const source = readFileSync(file, "utf8")
  const { blocks } = JSON.parse(loadNative().scanComponent(file, source)) as {
    blocks: { label: string; start: number; end: number; lang: string }[]
  }
  // Linters differ at the block's edges: ESLint's Vue parser hands over the block as written, and
  // oxlint drops its leading line break (KF-034), so the line breaks around it do not count.
  const block = blocks.find(
    (candidate) =>
      edges(source.slice(candidate.start, candidate.end)) === edges(text)
  )
  return block ? `${file}.${block.label}.${block.lang}` : file
}

/** Text without the line breaks that open and close it. */
const edges = (text: string) => text.replace(/^[\r\n]+|[\r\n]+$/g, "")

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
  const module = moduleOf(file, text)
  const result = driver.transform(module, text, { map: false })
  const relative = path.relative(driver.root, module).split(path.sep).join("/")
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
    sites: driver.sites(module).map((site) => ({
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
