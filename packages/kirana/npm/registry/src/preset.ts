/**
 * `kirana-style ui preset <code>` (KRN-DX-032, D-110): a project's design changed in one command.
 * The code is read with the installed design system's own layouts; the design goes to `ui.design`,
 * its axes to attributes on `<html>`, and every installed item is placed again as `update` writes
 * it. The font items the new values name are installed; one no value names any more is left for
 * `remove` (KF-050).
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"

import { installCommand, sources } from "@kirana-style/compiler"

import {
  checkWritten,
  chooseBase,
  installPackages,
  missingPackages,
  place,
  plan,
  record,
  scriptsOf,
  writeEdits,
  writePlaced,
} from "./add.ts"
import type { Placed, Planned } from "./add.ts"
import { failureLine, parseArgs } from "./command.ts"
import type { Options } from "./command.ts"
import { allAxisItems, axisItems, importFonts } from "./font.ts"
import { writeLockfile } from "./lockfile.ts"
import { read } from "./read.ts"
import { FRAMEWORKS, ICON_LIBRARIES } from "./schema.ts"
import type { Settings } from "./settings.ts"
import { installedProject, statusOf } from "./status.ts"
import type { Design, Framework, IconLibrary, Item } from "./types.ts"
import { reconcile, recordStatuses } from "./update.ts"

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/**
 * The values a code holds, by axis, read with the layout its first letter names: the rest is a
 * base-62 number holding one index per field from bit 0, and an index past a list's end reads as
 * its first value. Undefined when no layout reads it.
 */
export function decodePreset(
  code: string,
  design: Design
): Record<string, string> | undefined {
  const layout = design.presets?.[code[0] ?? ""]
  const digits = code.slice(1)
  if (!layout || !/^[0-9A-Za-z]+$/.test(digits)) return undefined
  let value = 0
  for (const digit of digits) value = value * 62 + BASE62.indexOf(digit)
  const values: Record<string, string> = {}
  let offset = 0
  // Division rather than shifts: JavaScript's bitwise operators truncate to 32 bits.
  for (const field of layout) {
    const index = Math.floor(value / 2 ** offset) % 2 ** field.bits
    values[field.axis] = field.values[index] ?? field.values[0]!
    offset += field.bits
  }
  return values
}

/** The settings a decoded preset gives: its design axes, and the framework, base and icon library it names. */
export function settingsOf(
  values: Readonly<Record<string, string>>,
  design: Design
): Pick<Settings, "design"> &
  Partial<Pick<Settings, "framework" | "base" | "iconLibrary">> {
  const { framework, base, iconLibrary } = values
  return {
    design: Object.fromEntries(
      Object.entries(values).filter(([axis]) => axis in design.axes)
    ),
    ...(FRAMEWORKS.includes(framework as Framework)
      ? { framework: framework as Framework }
      : {}),
    ...(base === undefined ? {} : { base }),
    ...(ICON_LIBRARIES.includes(iconLibrary as IconLibrary)
      ? { iconLibrary: iconLibrary as IconLibrary }
      : {}),
  }
}

/**
 * Whether a script renders `<html>`: an element in its code, not a mention in a comment (a design
 * system's own module may describe what `<html>` takes).
 */
export function rendersHtml(text: string): boolean {
  let code = ""
  for (let at = 0; at < text.length; at++) {
    if (text.startsWith("//", at)) {
      const end = text.indexOf("\n", at)
      at = end < 0 ? text.length : end
    } else if (text.startsWith("/*", at)) {
      const end = text.indexOf("*/", at + 2)
      at = end < 0 ? text.length : end + 1
    } else code += text[at]
  }
  return /<html[\s>]/.test(code)
}

/** The index of the first character from `at` that is neither space nor a comment. */
function skipTrivia(text: string, at: number): number {
  for (;;) {
    while (at < text.length && /\s/.test(text[at]!)) at++
    if (text.startsWith("//", at)) {
      const end = text.indexOf("\n", at)
      at = end < 0 ? text.length : end
    } else if (text.startsWith("/*", at)) {
      const end = text.indexOf("*/", at + 2)
      at = end < 0 ? text.length : end + 2
    } else return at
  }
}

/**
 * The index after the value that starts at `start`, at the depth it starts: the `,` or closing
 * bracket that ends it (the bracket alone without `commas`), past strings, comments and brackets.
 */
function valueEnd(text: string, start: number, commas = true): number {
  let depth = 0
  for (let at = start; at < text.length; at++) {
    const char = text[at]!
    // A value's own comment ends it, as its comma does: `b: 1 // the default`.
    const comment = text.startsWith("//", at) || text.startsWith("/*", at)
    if (comment && commas && depth === 0) return at
    if (char === '"' || char === "'" || char === "`") {
      for (at++; at < text.length && text[at] !== char; at++)
        if (text[at] === "\\") at++
    } else if (text.startsWith("//", at)) {
      const end = text.indexOf("\n", at)
      at = end < 0 ? text.length : end
    } else if (text.startsWith("/*", at)) {
      const end = text.indexOf("*/", at + 2)
      at = end < 0 ? text.length : end + 1
    } else if (char === "{" || char === "[" || char === "(") depth++
    else if (char === "}" || char === "]" || char === ")") {
      if (depth === 0) return at
      depth--
    } else if (commas && char === "," && depth === 0) return at
  }
  return text.length
}

/**
 * The `ui` object of a configuration module with these keys set: a key it has gets its value
 * replaced, one it lacks is added first; everything else is left as written. Undefined when the
 * module has no `ui: {`.
 */
export function setUi(
  text: string,
  values: Readonly<Record<string, unknown>>
): string | undefined {
  const opener = /(["']?)ui\1\s*:\s*\{/.exec(text)
  if (!opener) return undefined
  const open = opener.index + opener[0].length
  // The object's own closing brace, past its commas.
  const close = valueEnd(text, open, false)
  let body = text.slice(open, close)
  const literal = (value: unknown) =>
    JSON.stringify(value, null, 2).replaceAll("\n", "\n    ")
  for (const [key, value] of Object.entries(values)) {
    // The key at the object's own depth: after its `{` or a `,`, never inside a nested value.
    let found: { start: number; end: number } | undefined
    for (let at = skipTrivia(body, 0); at < body.length;) {
      const property = new RegExp(`^(["']?)${key}\\1\\s*:\\s*`).exec(
        body.slice(at)
      )
      const end = valueEnd(body, at + (property?.[0].length ?? 0))
      if (property) {
        // The value alone, without the space before what ends it.
        let last = end
        while (/\s/.test(body[last - 1]!)) last--
        found = { start: at + property[0].length, end: last }
        break
      }
      at = skipTrivia(body, end + 1)
    }
    body = found
      ? `${body.slice(0, found.start)}${literal(value)}${body.slice(found.end)}`
      : `\n    ${key}: ${literal(value)},${body}`
  }
  return `${text.slice(0, open)}${body}${text.slice(close)}`
}

/** `<html …>` with these attributes set, each replaced where the tag has it and added where it does not. */
export function withAttributes(
  text: string,
  attributes: Readonly<Record<string, string>>
): string {
  const start = text.indexOf("<html")
  const end = text.indexOf(">", start)
  let tag = text.slice(start, end)
  for (const [name, value] of Object.entries(attributes)) {
    const at = tag.indexOf(` ${name}="`)
    tag =
      at < 0
        ? `<html ${name}="${value}"${tag.slice("<html".length)}`
        : `${tag.slice(0, at)} ${name}="${value}"${tag.slice(tag.indexOf('"', at + name.length + 3) + 1)}`
  }
  return `${text.slice(0, start)}${tag}${text.slice(end)}`
}

/**
 * Where the design's attributes go: the one script that renders `<html>` (a layout), else a static
 * app's `index.html`; undefined when there is neither, or several layouts.
 */
export function documentOf(root: string): string | undefined {
  const layouts = sources(root).filter((file) =>
    rendersHtml(readFileSync(file, "utf8"))
  )
  if (layouts.length === 1) return layouts[0]!
  const html = path.join(root, "index.html")
  return layouts.length === 0 && existsSync(html) ? html : undefined
}

/** The design's axes as `<html>` attributes. */
export const attributesOf = (
  design: Design,
  values: Readonly<Record<string, string>>
) =>
  Object.fromEntries(
    Object.entries(values).map(([axis, value]) => [
      design.axes[axis]!.attribute,
      value,
    ])
  )

/** `preset <code>`. */
export async function runPreset(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options = {}
): Promise<number> {
  const parsed = parseArgs("preset", args, [
    "--dry-run",
    "--overwrite",
    "--no-check",
  ])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  if (parsed.rest.length !== 1) {
    write("kirana-style ui preset takes one code\n")
    return 2
  }
  const code = parsed.rest[0]!
  const found = await installedProject(cwd, options)
  if (typeof found === "string") {
    write(`${found}\n`)
    return 2
  }
  const { settings, project, lockfile } = found

  // The installed design system, as its registry has it now.
  let system: { key: string; item: Item } | undefined
  try {
    for (const key of Object.keys(lockfile.items)) {
      const item = (await read(key, settings, options)).document as Item
      if (item.type === "design-system" && item.design) {
        system = { key, item }
        break
      }
    }
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 1
  }
  if (!system) {
    write(
      "no design system with a design is installed: kirana-style ui init installs one\n"
    )
    return 1
  }
  const design = system.item.design!
  const values = decodePreset(code, design)
  if (!values) {
    write(
      `${code} is not a preset code of ${system.key}, whose layouts start with ${Object.keys(design.presets ?? {}).join(", ") || "nothing"}\n`
    )
    return 1
  }
  const chosen = settingsOf(values, design)
  const next: Settings = { ...settings, ...chosen }
  const framework = chosen.framework ?? settings.framework
  write(
    `${code}: ${Object.entries(chosen.design)
      .map(([axis, value]) => `${axis} ${value}`)
      .join(", ")}${chosen.base ? `, base ${chosen.base}` : ""}\n`
  )

  // Every installed item, placed again for the new design and base.
  const { statuses, failures } = await statusOf(
    [],
    next,
    project,
    lockfile,
    options,
    (key, item, locked) =>
      item.frameworks
        ? chooseBase(key, item, framework ?? locked.framework, next.base)
        : {}
  )
  for (const failure of failures) write(failureLine(failure))
  if (failures.length > 0) return 1
  const { writes, deletes, conflicts } = reconcile(
    statuses.filter((status) =>
      status.files.some((file) => file.registry !== "same" || file.restyled)
    ),
    project.root,
    parsed.flags.has("--overwrite"),
    (status) =>
      write(
        `${status.key}${status.planned.design ? ` · ${status.planned.design}` : ""}${status.planned.framework ? ` · ${status.planned.framework}/${status.planned.base}` : ""}\n`
      ),
    write
  )

  // The font items the new values name that are not installed, placed as `add` places them.
  const wanted = axisItems(design, chosen.design, system.key)
  let added: Planned[]
  let fonts: Placed[]
  try {
    added = await plan(
      wanted.filter((key) => lockfile.items[key] === undefined),
      next,
      project,
      options
    )
    fonts = place(added, next, project)
  } catch (error) {
    write(`${(error as Error).message}\n`)
    return 1
  }
  const marks = { new: "+", same: "=", differs: "!" } as const
  for (const { key, item } of added) {
    write(`${key} ${item.version}\n`)
    for (const file of fonts.filter((entry) => entry.item === key))
      write(`  ${marks[file.state]} ${file.relative}\n`)
  }
  const imports = importFonts(added, scriptsOf(project.root), (file) =>
    readFileSync(path.join(project.root, file), "utf8")
  )
  for (const line of imports.report) write(`font: ${line}\n`)
  for (const line of imports.manual) write(`by hand: ${line}\n`)
  for (const key of allAxisItems(design, system.key))
    if (lockfile.items[key] !== undefined && !wanted.includes(key))
      write(
        `unused: ${key}, which no value names now: kirana-style ui remove ${key}\n`
      )
  if (!parsed.flags.has("--overwrite"))
    conflicts.push(
      ...fonts
        .filter((file) => file.state === "differs")
        .map((file) => file.relative)
    )

  // The settings and the document.
  const configFile = settings.file
  if (configFile === undefined) {
    write(
      "no kirana.config to write the design to: kirana-style ui init makes one\n"
    )
    return 1
  }
  const ui = {
    design: chosen.design,
    ...(chosen.framework === undefined ? {} : { framework: chosen.framework }),
    ...(chosen.base === undefined ? {} : { base: chosen.base }),
    ...(chosen.iconLibrary === undefined
      ? {}
      : { iconLibrary: chosen.iconLibrary }),
  }
  const configText = readFileSync(configFile, "utf8")
  let config: string | undefined
  if (configFile.endsWith(".json")) {
    const json = JSON.parse(configText) as { ui?: Record<string, unknown> }
    config = `${JSON.stringify({ ...json, ui: { ...json.ui, ...ui } }, null, 2)}\n`
  } else config = setUi(configText, ui)
  if (config === undefined) {
    write(
      `${configFile}: no ui: { … } to set the design in; set ui.design by hand\n`
    )
    return 1
  }
  write(
    `settings: ${path.relative(project.root, configFile)}: ui ${JSON.stringify(ui)}\n`
  )
  const document = documentOf(project.root)
  const attributes = attributesOf(design, chosen.design)
  if (document)
    write(
      `document: ${path.relative(project.root, document)}: <html> ${Object.entries(
        attributes
      )
        .map(([name, value]) => `${name}="${value}"`)
        .join(" ")}\n`
    )
  else
    write(
      "by hand: set the design's attributes on <html>, as no layout or index.html has it\n"
    )

  const packages = missingPackages(added, project, [...writes, ...fonts])
  const commands = installCommand(project.manager, packages, [])
  for (const command of commands) write(`packages: ${command}\n`)
  if (conflicts.length > 0) {
    write(
      `${conflicts.length} file(s) you changed would change: nothing written; --overwrite replaces them\n`
    )
    return 1
  }
  if (parsed.flags.has("--dry-run")) {
    write("dry run: nothing written\n")
    return 0
  }
  writeFileSync(configFile, config)
  if (document)
    writeFileSync(
      document,
      withAttributes(readFileSync(document, "utf8"), attributes)
    )
  writePlaced(writes)
  writePlaced(fonts)
  writeEdits(project.root, imports.edits)
  for (const file of deletes) unlinkSync(file)
  if (!installPackages(commands, project, write, options)) return 1
  recordStatuses(lockfile, statuses, writes)
  record(lockfile, added, fonts)
  writeLockfile(project.root, lockfile)
  write(
    `kirana-style.lock.json: ${statuses.length + added.length} item(s) recorded\n`
  )
  if (parsed.flags.has("--no-check")) return 0
  return (await checkWritten([...writes, ...fonts], project.root, write))
    ? 0
    : 1
}
