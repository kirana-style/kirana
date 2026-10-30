/**
 * `kirana-style ui init` (KRN-DX-029, D-109): Kirana's own setup where the project lacks it, the `ui`
 * settings, the registry's design-system item and its `setup` wired in, and with a preset the font
 * items its values name (KF-050). Every change is planned first, against files as the earlier changes
 * leave them; a change it cannot make safely is printed as a step to do by hand.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import {
  addImport,
  findConfigAbove,
  readJsonc,
  installCommand,
  planInit,
  REGISTRY,
  sources,
} from "@kirana-style/compiler"

import {
  checkWritten,
  designSystemsOf,
  installPackages,
  missingPackages,
  place,
  placeOf,
  plan,
  record,
  writePlaced,
} from "./add.ts"
import type { Placed } from "./add.ts"
import { parseArgs } from "./command.ts"
import type { Options } from "./command.ts"
import { axisItems, importFonts, STYLESHEET } from "./font.ts"
import { readLockfile, writeLockfile } from "./lockfile.ts"
import { aliasDirectory, frameworkOf, pathsOf, readProject } from "./project.ts"
import { read, RegistryError } from "./read.ts"
import { FRAMEWORKS, NAMESPACE_PATTERN, REFERENCE_PATTERN } from "./schema.ts"
import { loadSettings } from "./settings.ts"
import type { Settings } from "./settings.ts"
import {
  attributeList,
  attributesOf,
  decodePreset,
  DIRECTION,
  findDocument,
  optionAttributes,
  rendersHtml,
  settingsOf,
  withAttributes,
} from "./preset.ts"
import { fetchExample, writeExample } from "./template.ts"
import type { Framework, IconLibrary, Index, Item } from "./types.ts"
import { version } from "./version.ts"

/** Folders never searched for the project's own stylesheet. */
const SKIPPED = new Set(["node_modules", "dist", "build", "out", "coverage"])
const CONFIGS = [
  "kirana.config.ts",
  "kirana.config.mts",
  "kirana.config.js",
  "kirana.config.mjs",
  "kirana.config.json",
]

/** Files as the planned changes leave them, relative to the project's root. */
class Files {
  readonly changed = new Map<string, string>()
  readonly root: string

  constructor(root: string) {
    this.root = root
  }

  read(file: string): string | undefined {
    const absolute = path.join(this.root, file)
    return (
      this.changed.get(file) ??
      (existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined)
    )
  }

  write(file: string, text: string): void {
    this.changed.set(file, text)
  }

  /** `read` for an absolute path, as the alias resolution asks. */
  readonly absolute = (file: string): string | undefined =>
    this.read(path.relative(this.root, file).split(path.sep).join("/"))

  /** The project's stylesheets, those only planned included, outside installed packages and output. */
  stylesheets(): string[] {
    const found = new Set<string>()
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || SKIPPED.has(entry.name)) continue
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) walk(file)
        else if (entry.name.endsWith(".css"))
          found.add(path.relative(this.root, file).split(path.sep).join("/"))
      }
    }
    walk(this.root)
    for (const file of this.changed.keys())
      if (file.endsWith(".css")) found.add(file)
    return [...found].sort()
  }

  /** The project's scripts, those only planned included, relative and with forward slashes. */
  scripts(): string[] {
    const found = new Set(
      sources(this.root).map((file) =>
        path.relative(this.root, file).split(path.sep).join("/")
      )
    )
    for (const file of this.changed.keys())
      if (/\.[cm]?[jt]sx?$/.test(file)) found.add(file)
    return [...found].sort()
  }
}

/** The `ui` settings written into the configuration: what the flags say. */
type Chosen = {
  framework?: Framework
  base?: string
  aliases?: Settings["aliases"]
  iconLibrary?: IconLibrary
  /** The design a `--preset` code gives (D-110). */
  design?: Record<string, string>
  registries: Record<string, string>
}

/** Reads the flags into `Chosen`, or the message for exit 2. */
function chosenOf(values: Map<string, string[]>): Chosen | string {
  const framework = values.get("--framework")?.at(-1)
  if (framework !== undefined && !FRAMEWORKS.includes(framework as Framework))
    return `kirana-style ui init: --framework is one of ${FRAMEWORKS.join(", ")}`
  const base = values.get("--base")?.at(-1)
  if (base !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(base))
    return `kirana-style ui init: --base is a lower-case name, such as base or aria`
  const registries: Record<string, string> = {}
  for (const entry of values.get("--registry") ?? []) {
    const [namespace = "", template = ""] = entry.split(/=(.*)/s)
    if (!NAMESPACE_PATTERN.test(namespace) || !template.includes("{name}"))
      return `kirana-style ui init: --registry is @namespace=<template holding {name}>, not ${entry}`
    registries[namespace] = template
  }
  return {
    ...(framework === undefined ? {} : { framework: framework as Framework }),
    ...(base === undefined ? {} : { base }),
    registries,
  }
}

/** The settings with the flags over them, as they will read once the configuration is written. */
function withChosen(settings: Settings, chosen: Chosen): Settings {
  const registries = new Map(settings.registries)
  for (const [namespace, template] of Object.entries(chosen.registries))
    registries.set(namespace, { namespace, template, headers: {} })
  return {
    ...settings,
    registries,
    ...(chosen.framework === undefined ? {} : { framework: chosen.framework }),
    ...(chosen.base === undefined ? {} : { base: chosen.base }),
  }
}

/** The design-system item: the one asked for, else the first of its type in the registry's index. */
async function designOf(
  asked: string | undefined,
  namespace: string,
  settings: Settings,
  options: Options
): Promise<string> {
  if (asked !== undefined) {
    if (!REFERENCE_PATTERN.test(asked))
      throw new RegistryError(
        `${asked} is not an item: @namespace/name, or a name for @kirana's`
      )
    return asked.startsWith("@") ? asked : `${namespace}/${asked}`
  }
  const { document } = await read(`${namespace}/index`, settings, options)
  const found = (document as Index).items.find(
    (entry) => entry.type === "design-system"
  )
  if (!found)
    throw new RegistryError(
      `${namespace} has no design-system item in its index: name one with --design`
    )
  return `${namespace}/${found.name}`
}

/**
 * What Next.js requires of a `tsconfig.json`, and `noEmit`, which it suggests: a JavaScript app has
 * none until `next` writes one, and `ui` items are TypeScript (KF-046). Next.js fills in the rest on
 * its first run. As `next` 16.3 checks them (`writeConfigurationDefaults`).
 */
const NEXT_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      noEmit: true,
      module: "esnext",
      esModuleInterop: true,
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "react-jsx",
      incremental: true,
      plugins: [{ name: "next" }],
    },
  },
  null,
  2
)}\n`

/** The packages Next.js needs to compile TypeScript, which it installs itself only outside CI. */
const NEXT_TYPESCRIPT = ["typescript", "@types/react", "@types/node"]

/** A Next.js app without a `tsconfig.json`, which `init` gives one (KF-046). */
const untypedNext = (root: string, listed: Readonly<Record<string, string>>) =>
  "next" in listed && !existsSync(path.join(root, "tsconfig.json"))

/**
 * Aliases the project can resolve (D-108): `ui.aliases` as they are when its tsconfig maps them;
 * else following the prefix its `paths` already use (`~/*`, as TanStack Start's template has); else
 * `"@/*"` added to the tsconfig that holds its compiler options, with Vite told to read it; a
 * Next.js app without one gets one first.
 */
function prepareAliases(
  files: Files,
  settings: Settings,
  chosen: Chosen,
  report: string[],
  manual: string[],
  next: boolean
): Settings {
  const root = files.root
  const planned = files.absolute
  try {
    // Every type but `page` has a default alias.
    aliasDirectory(root, settings.aliases.ui!, planned)
    return settings
  } catch {
    // Not mapped: below.
  }
  if (next) {
    files.write("tsconfig.json", NEXT_TSCONFIG)
    report.push(
      "tsconfig.json: Next.js's compiler options, as `next` would write them"
    )
  }
  const found = pathsOf(path.join(root, "tsconfig.json"), planned)
  if (found) {
    const prefix = Object.keys(found.paths).find((key) => key.endsWith("/*"))
    if (prefix === undefined) return settings
    const aliases = Object.fromEntries(
      Object.entries(settings.aliases).map(([type, alias]) => [
        type,
        alias!.replace(/^@\//, prefix.slice(0, -1)),
      ])
    )
    chosen.aliases = aliases
    report.push(`ui.aliases follow tsconfig's ${prefix}`)
    return { ...settings, aliases }
  }
  const candidates = [
    "tsconfig.json",
    ...[
      ...(files.read("tsconfig.json") ?? "").matchAll(
        /"path"\s*:\s*"([^"]+)"/g
      ),
    ].map((match) => {
      const target = path.posix.normalize(match[1]!)
      return target.endsWith(".json") ? target : `${target}/tsconfig.json`
    }),
  ]
  const tsconfig = candidates.find((file) =>
    /"compilerOptions"\s*:\s*\{/.test(files.read(file) ?? "")
  )
  // None to edit: placing the files then stops, saying what to add.
  if (tsconfig === undefined) return settings
  const source = existsSync(path.join(root, "src")) ? "./src/*" : "./*"
  files.write(
    tsconfig,
    files
      .read(tsconfig)!
      .replace(
        /"compilerOptions"\s*:\s*\{/,
        (open) => `${open}\n    "paths": { "@/*": ["${source}"] },`
      )
  )
  report.push(`${tsconfig}: paths "@/*": ["${source}"]`)
  const vite = [
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.js",
    "vite.config.mjs",
  ].find((file) => files.read(file) !== undefined)
  if (vite !== undefined && !files.read(vite)!.includes("tsconfigPaths")) {
    const text = files.read(vite)!
    if (/\bresolve\s*:/.test(text) || !/defineConfig\(\s*\{/.test(text))
      manual.push(
        `${vite}: add resolve: { tsconfigPaths: true }, so Vite reads the aliases`
      )
    else {
      files.write(
        vite,
        text.replace(
          /defineConfig\(\s*\{/,
          (open) => `${open}\n  resolve: { tsconfigPaths: true },`
        )
      )
      report.push(`${vite}: resolve: { tsconfigPaths: true }`)
    }
  }
  return settings
}

/**
 * The configuration imports the design system's with its `.ts` extension, as Node.js loads it; a
 * tsconfig that type-checks the configuration (Next.js's includes every `.ts` file) must allow that.
 * Allowed in place when it emits nothing, which the option requires; else a step by hand.
 */
function allowTsImports(
  files: Files,
  config: string,
  report: string[],
  manual: string[]
): void {
  // Placing the files found the aliases through it, so it is there.
  const text = files.read("tsconfig.json")!
  const tsconfig = readJsonc(text) as {
    include?: string[]
    compilerOptions?: { allowImportingTsExtensions?: boolean; noEmit?: boolean }
  }
  const includes =
    tsconfig.include === undefined ||
    tsconfig.include.some(
      (pattern) => pattern === config || /^(\*\*\/)?\*\.ts$/.test(pattern)
    )
  const options = tsconfig.compilerOptions
  if (!includes || !options || options.allowImportingTsExtensions) return
  if (!options.noEmit) {
    manual.push(
      `tsconfig.json type-checks ${config}, whose import ends in .ts: set "allowImportingTsExtensions": true there, or leave ${config} out of its include`
    )
    return
  }
  files.write(
    "tsconfig.json",
    text.replace(
      /"compilerOptions"\s*:\s*\{/,
      (open) => `${open}\n    "allowImportingTsExtensions": true,`
    )
  )
  report.push(
    `tsconfig.json: allowImportingTsExtensions, for ${config}'s import`
  )
}

/**
 * The design's axes and the project options as attributes on `<html>`, in the root document
 * `findDocument` names; a step by hand when there is none.
 */
function setAttributes(
  files: Files,
  attributes: Readonly<Record<string, string | undefined>>,
  report: string[],
  manual: string[]
): void {
  const document = findDocument(files.scripts(), (file) => files.read(file))
  const listed = attributeList(attributes)
  if (document === undefined) {
    manual.push(`set <html>'s attributes: ${listed}`)
    return
  }
  files.write(document, withAttributes(files.read(document)!, attributes))
  report.push(`${document}: <html ${listed}>`)
}

/** What a setup entry names, among the files being installed. */
function installedOf(
  module: string,
  placed: readonly Placed[]
): Placed | undefined {
  const [, type, rest] = /^@\/registry\/([a-z]+)\/(.+)$/.exec(module)!
  return placed.find(
    (file) =>
      file.file.type === type &&
      placeOf(type!, file.file.path) === placeOf(type!, rest!)
  )
}

/** An empty string in the module's own quotes: single when its imports use only those. */
const quotes = (text: string) =>
  /(from|import)\s*'/.test(text) && !/(from|import)\s*"/.test(text)
    ? "''"
    : '""'

/** Whether the `<html>` element's own tag already has an `sx`. */
function htmlTakesSx(text: string): boolean {
  const start = text.indexOf("<html")
  return /\bsx=/.test(text.slice(start, text.indexOf(">", start)))
}

/** A JavaScript literal for the `ui` settings, indented as a property of the configuration. */
const literal = (value: unknown, indent = "") =>
  JSON.stringify(value, null, 2).replaceAll("\n", `\n${indent}`)

/**
 * The planned edits for the `ui` settings and the design system's `setup`, each a line to report;
 * what cannot be done safely goes to `manual`.
 */
function setUp(
  files: Files,
  chosen: Chosen,
  item: Item,
  placed: readonly Placed[],
  settings: Settings,
  report: string[],
  manual: string[]
): void {
  // Kirana's own setup creates one when the project has none.
  const config = CONFIGS.find((name) => files.read(name) !== undefined)!
  const ui = {
    ...(chosen.framework === undefined ? {} : { framework: chosen.framework }),
    ...(chosen.base === undefined ? {} : { base: chosen.base }),
    ...(chosen.aliases === undefined ? {} : { aliases: chosen.aliases }),
    ...(chosen.iconLibrary === undefined
      ? {}
      : { iconLibrary: chosen.iconLibrary }),
    ...(chosen.design === undefined ? {} : { design: chosen.design }),
    ...(Object.keys(chosen.registries).length > 0
      ? { registries: chosen.registries }
      : {}),
  }
  const setup = item.setup ?? {}
  let text = files.read(config)!
  const opener = /defineConfig\(\s*\{|export default \{/
  // A JSON configuration takes the settings, but cannot import the design system's configuration.
  if (config.endsWith(".json")) {
    if (Object.keys(ui).length > 0) {
      const json = JSON.parse(text) as { ui?: Record<string, unknown> }
      json.ui = { ...ui, ...json.ui }
      files.write(config, `${literal(json)}\n`)
      report.push(`${config}: ui ${JSON.stringify(ui)}`)
    }
    if (setup.config)
      manual.push(
        `${config} cannot import ${setup.config.export}: rename it kirana.config.ts and spread it into defineConfig`
      )
  } else if (!opener.test(text)) {
    const wanted = [
      ...(Object.keys(ui).length > 0 ? [`ui: ${JSON.stringify(ui)}`] : []),
      ...(setup.config ? [`...${setup.config.export}`] : []),
    ]
    if (wanted.length > 0)
      manual.push(
        `${config}: no defineConfig({ … }) to edit: add ${wanted.join(" and ")} by hand`
      )
  } else {
    if (Object.keys(ui).length > 0) {
      if (/\bui\s*:/.test(text))
        manual.push(`${config} has ui already: set ${JSON.stringify(ui)} in it`)
      else {
        text = text.replace(
          opener,
          (open) => `${open}\n  ui: ${literal(ui, "  ")},`
        )
        report.push(`${config}: ui ${JSON.stringify(ui)}`)
      }
    }
    if (setup.config && !text.includes(`...${setup.config.export}`)) {
      const target = installedOf(setup.config.module, placed)
      if (!target)
        throw new RegistryError(
          `${item.name}: setup.config names ${setup.config.module}, which the item does not install`
        )
      const relative = path
        .relative(
          path.dirname(path.join(files.root, config)),
          target.destination
        )
        .split(path.sep)
        .join("/")
      // A module above the configuration's folder keeps its `../`.
      const specifier = relative.startsWith("../") ? relative : `./${relative}`
      text = text.replace(
        opener,
        (open) => `${open}\n  ...${setup.config!.export},`
      )
      text = addImport(
        text,
        `import { ${setup.config.export} } from "${specifier}"`
      )
      report.push(`${config}: spreads ${setup.config.export} (${specifier})`)
      if (/\.[cm]?ts$/.test(config))
        allowTsImports(files, config, report, manual)
    }
    // An empty `defineConfig({})` keeps its closing brace on a line of its own.
    files.write(config, text.replace(/,\}\)/, ",\n})"))
  }

  const aliased = (module: string) => {
    const [, type, rest] = /^@\/registry\/([a-z]+)\/(.+)$/.exec(module)!
    return `${settings.aliases[type as keyof Settings["aliases"]]}/${rest}`
  }
  const scripts = files.scripts()
  const entry = scripts.find((file) => files.read(file)!.includes(STYLESHEET))
  // Where Kirana's stylesheet is a PostCSS directive (`@kirana;`, as in Next.js's globals.css).
  const cssEntry =
    entry === undefined
      ? files
          .stylesheets()
          .find((file) => /^[ \t]*@kirana\b/m.test(files.read(file)!))
      : undefined
  for (const stylesheet of setup.stylesheets ?? []) {
    const specifier = aliased(stylesheet)
    if (entry !== undefined) {
      if (!files.read(entry)!.includes(specifier)) {
        files.write(
          entry,
          addImport(files.read(entry)!, `import "${specifier}"`)
        )
        report.push(`${entry}: imports ${specifier}`)
      }
    } else if (cssEntry !== undefined) {
      const target = installedOf(stylesheet, placed)
      if (!target)
        throw new RegistryError(
          `${item.name}: setup.stylesheets names ${stylesheet}, which the item does not install`
        )
      const relative = path
        .relative(
          path.dirname(path.join(files.root, cssEntry)),
          target.destination
        )
        .split(path.sep)
        .join("/")
      const imported = relative.startsWith("../") ? relative : `./${relative}`
      const css = files.read(cssEntry)!
      // CSS takes @import before every other rule.
      if (!css.includes(imported)) {
        files.write(cssEntry, `@import "${imported}";\n${css}`)
        report.push(`${cssEntry}: imports ${imported}`)
      }
    } else manual.push(`import "${specifier}" after Kirana's stylesheet`)
  }
  if (setup.document) {
    const { export: name } = setup.document
    const specifier = aliased(setup.document.module)
    const documents = scripts.filter((file) => rendersHtml(files.read(file)!))
    const html = documents.length === 1 ? documents[0]! : undefined
    if (html !== undefined && !htmlTakesSx(files.read(html)!)) {
      const withSx = files
        .read(html)!
        .replace(/<html(?=[\s>])/, `<html sx={${name}}`)
      files.write(
        html,
        addImport(withSx, `import { ${name} } from "${specifier}"`)
      )
      report.push(`${html}: <html sx={${name}}>`)
    } else if (
      html === undefined &&
      documents.length === 0 &&
      entry &&
      files.read(entry)!.includes(`props(${name})`)
    ) {
      // Set up already.
    } else if (html === undefined && documents.length === 0 && entry) {
      // A static index.html cannot take sx: the entry sets the classes before the app renders.
      const imported = addImport(
        addImport(
          files.read(entry)!,
          `import { props } from "@kirana-style/core"`
        ),
        `import { ${name} } from "${specifier}"`
      )
      const imports = [
        ...imported.matchAll(/^import\b[^;]*?["'][^"'\n]+["'];?[ \t]*$/gm),
      ]
      const end = imports.at(-1)!.index + imports.at(-1)![0].length
      files.write(
        entry,
        `${imported.slice(0, end)}\n\ndocument.documentElement.className = props(${name}).className ?? ${quotes(imported)}${imported.slice(end)}`
      )
      report.push(`${entry}: sets <html>'s classes from ${name}`)
    } else
      manual.push(
        `give <html> the design system's styles: <html sx={${name}}>, with import { ${name} } from "${specifier}"`
      )
  }
}

/**
 * `init`: plans Kirana's setup, the design system and its wiring, then writes it all, installs the
 * packages and records the lockfile. Exit 1 when a document cannot be read or the setup cannot be
 * planned, 2 for an unknown option or settings it cannot use.
 */
export async function runInit(
  args: readonly string[],
  start: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs(
    "init",
    args,
    [
      "--dry-run",
      "--overwrite",
      "--no-check",
      "--pointer",
      "--no-pointer",
      "--rtl",
      "--no-rtl",
    ],
    [
      "--framework",
      "--base",
      "--registry",
      "--design",
      "--template",
      "--preset",
    ]
  )
  const chosen = typeof parsed === "string" ? parsed : chosenOf(parsed.values)
  if (typeof parsed === "string" || typeof chosen === "string") {
    write(`${typeof parsed === "string" ? parsed : (chosen as string)}\n`)
    return 2
  }
  const asked = optionAttributes(parsed.flags)
  if (typeof asked === "string") {
    write(`kirana-style ui init: ${asked}\n`)
    return 2
  }
  // The project: where the command runs, or the template's new directory.
  let cwd = start
  const template = parsed.values.get("--template")?.at(-1)
  if (parsed.rest.length > (template === undefined ? 0 : 1)) {
    write(
      template === undefined
        ? `kirana-style ui init takes no item: ${parsed.rest.join(" ")}\n`
        : "kirana-style ui init --template takes one directory\n"
    )
    return 2
  }
  if (template !== undefined) {
    if (parsed.flags.has("--dry-run")) {
      write("kirana-style ui init: --dry-run cannot start from a template\n")
      return 2
    }
    const release = await version()
    const directory = path.resolve(cwd, parsed.rest[0] ?? template)
    try {
      writeExample(
        await fetchExample(template, release, options),
        directory,
        release
      )
    } catch (error) {
      write(`${(error as Error).message}\n`)
      return 1
    }
    write(`template: Kirana ${release}'s ${template} in ${directory}\n`)
    cwd = directory
  }
  let settings: Settings
  try {
    settings = withChosen(await loadSettings(cwd, options.load), chosen)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 2
  }
  const configFile = findConfigAbove(cwd)
  const root = configFile === undefined ? cwd : path.dirname(configFile)
  const project = readProject(root)
  if (settings.framework === undefined) {
    const detected = frameworkOf(project)
    if (detected !== undefined) {
      settings = { ...settings, framework: detected }
      chosen.framework = detected
    }
  }

  // Kirana's own setup, as `kirana-style init` plans it.
  const next = untypedNext(root, project.listed)
  const kirana = planInit(root, { typescript: next })
  const files = new Files(root)
  const report: string[] = []
  const manual: string[] = []
  for (const step of kirana.steps) {
    if (step.status === "change") {
      for (const change of step.changes) files.write(change.file, change.after)
      report.push(`kirana: ${step.name}: ${step.detail}`)
    } else if (step.status === "manual")
      manual.push(`kirana: ${step.name}: ${step.detail}`)
  }

  let placed: Placed[]
  let planned
  let lockfile
  try {
    // The registry named on the command line, else the one the configuration names, else @kirana.
    const namespace =
      Object.keys(chosen.registries)[0] ??
      [...settings.registries.keys()].find((name) => name !== "@kirana") ??
      "@kirana"
    const design = await designOf(
      parsed.values.get("--design")?.at(-1),
      namespace,
      settings,
      options
    )
    // A preset, read with the design system's own layouts before anything is placed for it, and
    // the font items its values name (KF-050).
    const preset = parsed.values.get("--preset")?.at(-1)
    const fonts: string[] = []
    if (preset !== undefined) {
      const item = (await read(design, settings, options)).document as Item
      const values = item.design && decodePreset(preset, item.design)
      if (!values)
        throw new RegistryError(
          `${preset} is not a preset code of ${design}${item.design ? "" : ", which describes no design"}`
        )
      const given = settingsOf(values, item.design!)
      Object.assign(chosen, given)
      settings = { ...settings, ...given }
      fonts.push(...axisItems(item.design!, given.design, design))
    }
    settings = prepareAliases(files, settings, chosen, report, manual, next)
    planned = await plan([design, ...fonts], settings, project, options)
    placed = place(planned, settings, project, files.absolute)
    const system = planned.find((entry) => entry.key === design)!.item
    setUp(files, chosen, system, placed, settings, report, manual)
    const imports = importFonts(planned, files.scripts(), (file) =>
      files.read(file)
    )
    for (const [file, text] of imports.edits) files.write(file, text)
    report.push(...imports.report)
    manual.push(...imports.manual)
    const attributes = {
      ...(chosen.design && system.design
        ? attributesOf(system.design, chosen.design)
        : {}),
      ...asked,
    }
    if (Object.keys(attributes).length > 0)
      setAttributes(files, attributes, report, manual)
    if (asked.dir === "rtl") manual.push(DIRECTION)
    lockfile = readLockfile(root)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 1
  }

  const marks = { new: "+", same: "=", differs: "!" } as const
  const own = (line: string) => line.startsWith("kirana: ")
  for (const line of report.filter(own)) write(`${line}\n`)
  for (const { key, item, framework, base } of planned) {
    write(
      `${key} ${item.version}${framework ? ` · ${framework}/${base}` : ""}\n`
    )
    for (const file of placed.filter((entry) => entry.item === key))
      write(`  ${marks[file.state]} ${file.relative}\n`)
  }
  for (const line of report.filter((entry) => !own(entry)))
    write(`setup: ${line}\n`)
  for (const line of manual) write(`by hand: ${line}\n`)
  // Kirana's own packages, this one among them so that `kirana-style ui` runs in the project
  // (KF-035), recorded exactly as a template's are: at this release, unless the design system names
  // a version of one. Other packages (Next.js's PostCSS, the design system's) as they are named.
  const release = await version()
  const versioned = missingPackages(planned, project, placed)
  const named = (entry: string) => entry.replace(/(?<=.)@.*$/, "")
  const ours = (entry: string) =>
    named(entry) === "kirana-style" || named(entry).startsWith("@kirana-style/")
  const unnamed = (names: readonly string[]) =>
    names.filter((name) => !versioned.some((entry) => named(entry) === name))
  const pinned = (names: readonly string[]) =>
    unnamed(names.filter(ours)).map((name) => `${name}@${release}`)
  const others = (names: readonly string[]) =>
    unnamed(names.filter((name) => !ours(name)))
  const development = [
    ...kirana.development,
    ...(REGISTRY in project.listed ? [] : [REGISTRY]),
    ...(next
      ? NEXT_TYPESCRIPT.filter((name) => !(name in project.listed))
      : []),
  ]
  const commands = [
    ...installCommand(
      project.manager,
      [...pinned(kirana.dependencies), ...versioned.filter(ours)],
      pinned(development),
      { exact: true }
    ),
    ...installCommand(
      project.manager,
      [
        ...others(kirana.dependencies),
        ...versioned.filter((entry) => !ours(entry)),
      ],
      others(development)
    ),
  ]
  for (const command of commands) write(`packages: ${command}\n`)
  const conflicts = placed.filter((file) => file.state === "differs")
  if (conflicts.length > 0 && !parsed.flags.has("--overwrite")) {
    write(
      `${conflicts.length} file(s) the project has would change (!): nothing written; --overwrite replaces them\n`
    )
    return 1
  }
  if (parsed.flags.has("--dry-run")) {
    write("dry run: nothing written\n")
    return 0
  }
  for (const [file, text] of files.changed) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), text)
  }
  writePlaced(placed)
  if (!installPackages(commands, project, write, options)) return 1
  record(lockfile, planned, placed)
  writeLockfile(root, lockfile)
  write(`kirana-style.lock.json: ${planned.length} item(s) recorded\n`)
  if (parsed.flags.has("--no-check")) return 0
  return (await checkWritten(placed, root, write, designSystemsOf(planned)))
    ? 0
    : 1
}
