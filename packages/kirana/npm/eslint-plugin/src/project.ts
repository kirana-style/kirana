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
  templateAnchors,
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

/** Where a component's script blocks and `sx` bindings are (UTF-16 offsets). */
type Component = {
  blocks: { label: string; start: number; end: number; lang: string }[]
  bindings: { expression: string }[]
  target: string | null
}

const scan = (file: string, source: string) =>
  JSON.parse(loadNative().scanComponent(file, source)) as Component

/**
 * One module of the linted text: its id, its text, what the build appends to it, and the UTF-8
 * byte offset its text starts at in the linted text.
 */
type Part = { id: string; text: string; appended: string; offset: number }

/**
 * A script block compiled as the build compiles it, as `Card.vue.setup.ts`: under that id the
 * compiler knows that the template, outside the module, reads the block's bindings
 * (`const { sx } = useSx()`, KF-026). The block the template sees also gets the anchors its
 * bindings name, as in the build, so an anchor applied only there counts (KF-090).
 */
function blockPart(
  file: string,
  component: Component,
  block: Component["blocks"][number],
  text: string,
  offset: number
): Part {
  return {
    id: `${file}.${block.label}.${block.lang}`,
    text,
    appended:
      block.label === component.target
        ? templateAnchors(component.bindings)
        : "",
    offset,
  }
}

/**
 * The modules a file's linted text is compiled as. Oxlint hands a rule one script block of a Vue,
 * Svelte or Astro component, found here among the file's blocks on disk. ESLint's component parsers
 * (`vue-eslint-parser`, `svelte-eslint-parser`, `astro-eslint-parser`, each with parser services)
 * hand over the whole file, markup and all, so each of its script blocks is compiled where it sits
 * in the text, and a component without one has nothing to compile (KF-116). Any other file is its
 * own module.
 */
function modulesOf(
  file: string,
  text: string,
  componentParser: boolean
): Part[] {
  const own = [{ id: file, text, appended: "", offset: 0 }]
  if (!frameworkOf(file)) return own
  const linted = scan(file, text)
  if (linted.blocks.length > 0 || componentParser)
    return linted.blocks.map((block) =>
      blockPart(
        file,
        linted,
        block,
        text.slice(block.start, block.end),
        Buffer.byteLength(text.slice(0, block.start))
      )
    )
  if (!existsSync(file)) return own
  const source = readFileSync(file, "utf8")
  const component = scan(file, source)
  // Oxlint drops the block's leading line break (KF-034), so the line breaks around it do not count.
  const block = component.blocks.find(
    (candidate) =>
      edges(source.slice(candidate.start, candidate.end)) === edges(text)
  )
  return block ? [blockPart(file, component, block, text, 0)] : own
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
  const parts = modulesOf(
    file,
    text,
    Object.keys(context.sourceCode.parserServices ?? {}).length > 0
  )
  const diagnostics: Diagnostic[] = []
  const sites: Site[] = []
  for (const part of parts) {
    const result = driver.transform(part.id, part.text + part.appended, {
      map: false,
    })
    const relative = path
      .relative(driver.root, part.id)
      .split(path.sep)
      .join("/")
    const length = Buffer.byteLength(part.text)
    // What the engine says of the appended anchors is the template's, which the build does not check.
    const linted = ({ span }: { span: { start: number } }) =>
      span.start < length
    const place = <T extends { span: { start: number; end: number } }>(
      found: T
    ): T => ({
      ...found,
      span: {
        start: found.span.start + part.offset,
        end: found.span.end + part.offset,
      },
    })
    diagnostics.push(
      ...[
        ...result.diagnostics,
        ...driver
          .diagnostics()
          .filter((diagnostic) => diagnostic.file === relative),
      ]
        .filter(linted)
        .map(place)
    )
    sites.push(...driver.sites(part.id).filter(linted).map(place))
  }
  // ASCII text has the same byte and string offsets.
  const ascii = Buffer.byteLength(text) === text.length
  const index = ascii
    ? (byte: number) => byte
    : (byte: number) => utf16Offset(text, byte)
  const inspection: Inspection = {
    driver,
    file,
    text,
    diagnostics,
    sites: sites.map((site) => ({
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
